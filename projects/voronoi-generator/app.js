import { createRandom, MAX_SITES } from "./simulation.js";
import { createRenderer } from "./renderer.js";
import { generateVoronoiSvg } from "./svg-export.js";

const EXPORT_WIDTH = 1200;
const EXPORT_HEIGHT = 760;
const controls = document.querySelector("[data-controls]");
const canvas = document.querySelector("[data-canvas]");
const stage = document.querySelector("[data-stage]");
const renderer = createRenderer(canvas);
let sites = [];
let siteSignature = "";
let renderFrame;
let toastTimer;

const hexToRgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);

function readConfig() {
  const data = new FormData(controls);
  return {
    seed: Math.max(0, Math.min(999999, Number(data.get("seed")) || 0)),
    siteCount: Number(data.get("siteCount")),
    subdivisionFrequency: Number(data.get("subdivisionFrequency")),
    densityVariation: Number(data.get("densityVariation")),
    densityScale: Number(data.get("densityScale")),
    metric: data.get("metric"),
    gap: Number(data.get("gap")),
    lineWidth: Number(data.get("lineWidth")),
    softness: Number(data.get("softness")),
    rounding: Number(data.get("rounding")),
    pointSize: Number(data.get("pointSize")),
    foreground: data.get("foreground"),
    background: data.get("background"),
    line: data.get("line"),
  };
}

function createSites(
  seed,
  count,
  minimumDistance,
  densityVariation,
  densityScale,
  subdivisionFrequency,
) {
  const random = createRandom(seed);
  const aspect = EXPORT_WIDTH / EXPORT_HEIGHT;
  const candidatesPerSite = 320;
  const generated = [];

  const hash = (x, y) => {
    let value = Math.imul(x, 374761393)
      + Math.imul(y, 668265263)
      + Math.imul(seed ^ 0x9e3779b9, 1442695041);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
  };

  const noise = (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const top = hash(x0, y0) * (1 - sx) + hash(x0 + 1, y0) * sx;
    const bottom = hash(x0, y0 + 1) * (1 - sx) + hash(x0 + 1, y0 + 1) * sx;
    return top * (1 - sy) + bottom * sy;
  };

  const fractalNoise = (x, y) => {
    let value = 0;
    let amplitude = 0.57;
    let frequency = 1;
    let amplitudeSum = 0;
    for (let octave = 0; octave < 4; octave += 1) {
      value += noise(x * frequency, y * frequency) * amplitude;
      amplitudeSum += amplitude;
      amplitude *= 0.48;
      frequency *= 2.03;
    }
    return value / amplitudeSum;
  };

  const densityAt = (point) => {
    const value = fractalNoise(
      point.x * aspect * densityScale,
      point.y * densityScale,
    );
    return 0.08 + Math.pow(value, 1.35) * 0.92;
  };

  // Best-candidate sampling keeps every new point as far as possible from the
  // existing set. Distances are measured in export-space, rather than in
  // normalized coordinates, so the spacing is visually uniform.
  while (generated.length < count) {
    let best;
    let bestDistance = -1;
    const attempts = generated.length === 0 ? 1 : candidatesPerSite;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidate = {
        x: 0.045 + random() * 0.91,
        y: 0.045 + random() * 0.91,
      };
      const nearestDistance = generated.reduce((minimum, site) => {
        const dx = (candidate.x - site.x) * aspect;
        const dy = candidate.y - site.y;
        return Math.min(minimum, Math.hypot(dx, dy));
      }, Infinity);
      const densityWeight = 0.18 + densityAt(candidate) * 0.82;
      const score = nearestDistance * (
        1 + densityVariation * (densityWeight * 1.9 - 1)
      );
      if (
        nearestDistance * EXPORT_HEIGHT >= minimumDistance
        && score > bestDistance
      ) {
        best = candidate;
        bestDistance = score;
      }
    }

    // A deterministic grid fallback prevents the variable-density bias from
    // jamming the sampler when clearance is set near its maximum.
    if (!best) {
      for (let row = 0; row < 44 && !best; row += 1) {
        for (let column = 0; column < 70; column += 1) {
          const candidate = {
            x: 0.045 + (column + 0.5) / 70 * 0.91,
            y: 0.045 + (row + 0.5) / 44 * 0.91,
          };
          const clearsSites = generated.every((site) => Math.hypot(
            (candidate.x - site.x) * EXPORT_WIDTH,
            (candidate.y - site.y) * EXPORT_HEIGHT,
          ) >= minimumDistance);
          if (clearsSites) {
            best = candidate;
            break;
          }
        }
      }
    }

    if (!best) {
      continue;
    }
    generated.push(best);
  }
  if (subdivisionFrequency <= 0 || generated.length >= MAX_SITES) {
    return generated;
  }

  const subdivisionRandom = createRandom(seed ^ 0x85ebca6b);
  const baseSites = [...generated];
  const subdivided = [];

  baseSites.forEach((site, siteIndex) => {
    const remainingBaseSites = baseSites.length - siteIndex - 1;
    const hasCapacity = subdivided.length + remainingBaseSites + 2 <= MAX_SITES;
    if (!hasCapacity || subdivisionRandom() >= subdivisionFrequency) {
      subdivided.push(site);
      return;
    }

    const otherSites = [
      ...subdivided,
      ...baseSites.slice(siteIndex + 1),
    ];
    const nearestNeighbor = otherSites.reduce((nearest, other) => Math.min(
      nearest,
      Math.hypot(
        (site.x - other.x) * EXPORT_WIDTH,
        (site.y - other.y) * EXPORT_HEIGHT,
      ),
    ), Infinity);
    const minimumRadius = Math.max(minimumDistance * 0.5, 5);
    const maximumRadius = Math.min(
      nearestNeighbor - minimumDistance,
      nearestNeighbor * 0.28,
      54,
    );

    let children;
    if (maximumRadius >= minimumRadius) {
      for (let attempt = 0; attempt < 28 && !children; attempt += 1) {
        const angle = subdivisionRandom() * Math.PI * 2;
        const radius = minimumRadius
          + subdivisionRandom() * (maximumRadius - minimumRadius);
        const offsetX = Math.cos(angle) * radius / EXPORT_WIDTH;
        const offsetY = Math.sin(angle) * radius / EXPORT_HEIGHT;
        const pair = [
          { x: site.x - offsetX, y: site.y - offsetY },
          { x: site.x + offsetX, y: site.y + offsetY },
        ];
        const insideField = pair.every((child) => (
          child.x >= 0.035 && child.x <= 0.965
          && child.y >= 0.035 && child.y <= 0.965
        ));
        const clearsNeighbors = pair.every((child) => otherSites.every((other) => (
          Math.hypot(
            (child.x - other.x) * EXPORT_WIDTH,
            (child.y - other.y) * EXPORT_HEIGHT,
          ) >= minimumDistance
        )));
        if (insideField && clearsNeighbors) children = pair;
      }
    }

    if (children) {
      subdivided.push(...children);
    } else {
      subdivided.push(site);
    }
  });

  return subdivided;
}

function updateOutputs(config) {
  const suffixes = { gap: " px", lineWidth: " px", softness: " px", rounding: " px", pointSize: " px" };
  controls.querySelectorAll("output[data-output]").forEach((output) => {
    const key = output.dataset.output;
    if (key === "densityVariation" || key === "subdivisionFrequency") {
      output.value = `${Math.round(config[key] * 100)}%`;
    } else if (key === "densityScale") {
      output.value = `${config[key]}×`;
    } else {
      output.value = `${config[key]}${suffixes[key] || ""}`;
    }
  });
  const cellReadout = sites.length === config.siteCount
    ? `${sites.length} cells`
    : `${config.siteCount} base · ${sites.length} cells`;
  document.querySelector("[data-seed-readout]").textContent = `Seed ${config.seed} · ${cellReadout}`;
  document.querySelector("[data-metric-readout]").textContent = `${config.metric === "manhattan" ? "Manhattan" : "Euclidean"} distance`;
}

function renderAt(width, height, pixelRatio = 1) {
  const config = readConfig();
  const minimumDistance = Math.max(
    2 * (config.gap + config.lineWidth),
    config.pointSize * 2 + 2,
  );
  const signature = `${config.seed}:${config.siteCount}:${minimumDistance}:${config.densityVariation}:${config.densityScale}:${config.subdivisionFrequency}`;
  if (signature !== siteSignature) {
    sites = createSites(
      config.seed,
      config.siteCount,
      minimumDistance,
      config.densityVariation,
      config.densityScale,
      config.subdivisionFrequency,
    );
    siteSignature = signature;
  }
  renderer.resize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
  renderer.render({ ...config, pixelRatio }, sites, {
    background: hexToRgb(config.background),
    foreground: hexToRgb(config.foreground),
    line: hexToRgb(config.line),
  });
  updateOutputs(config);
}

function render() {
  if (!renderer) return;
  const bounds = stage.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  renderAt(bounds.width, bounds.height, ratio);
}

function scheduleRender() {
  cancelAnimationFrame(renderFrame);
  renderFrame = requestAnimationFrame(render);
}

function showToast(message) {
  clearTimeout(toastTimer);
  const toast = document.querySelector("[data-toast]");
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

controls.addEventListener("input", scheduleRender);
window.addEventListener("resize", scheduleRender);
document.querySelector("[data-randomize]").addEventListener("click", () => {
  controls.elements.seed.value = String(Math.floor(Math.random() * 1_000_000));
  scheduleRender();
});
document.querySelector("[data-download]").addEventListener("click", () => {
  if (!renderer) return;
  const settings = readConfig();
  const svg = generateVoronoiSvg(settings, sites, EXPORT_WIDTH, EXPORT_HEIGHT);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.download = `voronoi-${settings.metric}-${settings.seed}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  showToast("SVG downloaded");
});

if (!renderer) {
  document.querySelector("[data-error]").hidden = false;
  canvas.hidden = true;
} else {
  new ResizeObserver(scheduleRender).observe(stage);
  render();
}
