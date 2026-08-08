import { createRenderer } from "../voronoi-generator/renderer.js";
import { createRandom, MAX_SITES } from "../voronoi-generator/simulation.js";

const WIDTH = 1200;
const HEIGHT = 760;
const CHUNK_SIZE = 0.75;
const RENDER_HALO = 0.3;
const RETENTION_MARGIN = 0.65;
const controls = document.querySelector("[data-controls]");
const canvas = document.querySelector("[data-canvas]");
const stage = document.querySelector("[data-stage]");
const toggleButton = document.querySelector("[data-toggle]");
const renderer = createRenderer(canvas);
let chunks = new Map();
let worldRandom;
let worldSignature = "";
let running = true;
let elapsed = 0;
let previousTime;
let camera = { x: 0, y: 0 };

const hexToRgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
const chunkKey = (x, y) => `${x}:${y}`;
const chunkSeed = (seed, x, y, visit) => {
  let value = seed ^ visit;
  value = Math.imul(value ^ x, 0x45d9f3b);
  value = Math.imul(value ^ y, 0x119de1f3);
  return (value ^ (value >>> 16)) >>> 0;
};

function noiseHash(x, y, seed) {
  let value = Math.imul(x, 374761393)
    + Math.imul(y, 668265263)
    + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const top = noiseHash(x0, y0, seed) * (1 - sx)
    + noiseHash(x0 + 1, y0, seed) * sx;
  const bottom = noiseHash(x0, y0 + 1, seed) * (1 - sx)
    + noiseHash(x0 + 1, y0 + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

function densityAt(x, y, settings) {
  let value = 0;
  let amplitude = 0.57;
  let amplitudeSum = 0;
  let frequency = 1;
  const scale = settings.densityScale;
  for (let octave = 0; octave < 4; octave += 1) {
    value += valueNoise(
      x * scale * WIDTH / HEIGHT * frequency,
      y * scale * frequency,
      settings.seed + octave * 1013,
    ) * amplitude;
    amplitudeSum += amplitude;
    amplitude *= 0.48;
    frequency *= 2.03;
  }
  return value / amplitudeSum;
}

function rgbToHsl([red, green, blue]) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;
  const delta = maximum - minimum;
  if (delta === 0) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (maximum === red) hue = ((green - blue) / delta) % 6;
  else if (maximum === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return [hue * 60, saturation, lightness];
}

function hslToRgb([hue, saturation, lightness]) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = ((hue % 360) + 360) % 360 / 60;
  const intermediate = chroma * (1 - Math.abs((section % 2) - 1));
  const pairs = [[chroma, intermediate, 0], [intermediate, chroma, 0], [0, chroma, intermediate], [0, intermediate, chroma], [intermediate, 0, chroma], [chroma, 0, intermediate]];
  const offset = lightness - chroma / 2;
  return pairs[Math.floor(section)].map((channel) => channel + offset);
}

function shiftHue(hex, degrees) {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl[0] += degrees;
  return hslToRgb(hsl);
}

function getConfig() {
  const data = new FormData(controls);
  return {
    seed: Number(data.get("seed")) || 0,
    siteCount: Number(data.get("siteCount")),
    densityVariation: Number(data.get("densityVariation")),
    densityScale: Number(data.get("densityScale")),
    subdivisionChance: Number(data.get("subdivisionChance")),
    subdivisionSpread: Number(data.get("subdivisionSpread")),
    flowDirection: Number(data.get("flowDirection")),
    flowSpeed: Number(data.get("flowSpeed")),
    turbulence: Number(data.get("turbulence")),
    driftSpeed: Number(data.get("driftSpeed")),
    hueSpeed: Number(data.get("hueSpeed")),
    metric: data.get("metric"),
    gap: Number(data.get("gap")),
    rounding: Number(data.get("rounding")),
    showPoints: data.has("showPoints"),
    foreground: data.get("foreground"),
    background: data.get("background"),
    line: data.get("line"),
  };
}

function resetWorld(settings, resetCamera = false) {
  chunks = new Map();
  worldRandom = createRandom(settings.seed ^ 0xa511e9b3);
  if (resetCamera) camera = { x: 0, y: 0 };
}

function pixelDistance(first, second) {
  const firstX = first.x ?? first.anchorX;
  const firstY = first.y ?? first.anchorY;
  const secondX = second.x ?? second.anchorX;
  const secondY = second.y ?? second.anchorY;
  return Math.hypot(
    (firstX - secondX) * WIDTH,
    (firstY - secondY) * HEIGHT,
  );
}

function neighboringAnchors(chunkX, chunkY) {
  const anchors = [];
  for (let y = chunkY - 1; y <= chunkY + 1; y += 1) {
    for (let x = chunkX - 1; x <= chunkX + 1; x += 1) {
      const chunk = chunks.get(chunkKey(x, y));
      if (chunk) anchors.push(...chunk.sites);
    }
  }
  return anchors;
}

function generateChunk(chunkX, chunkY, settings) {
  const visit = Math.floor(worldRandom() * 4294967296) >>> 0;
  const random = createRandom(chunkSeed(settings.seed, chunkX, chunkY, visit));
  const chunkCenterX = (chunkX + 0.5) * CHUNK_SIZE;
  const chunkCenterY = (chunkY + 0.5) * CHUNK_SIZE;
  const density = densityAt(chunkCenterX, chunkCenterY, settings);
  const densityFactor = 1 + settings.densityVariation
    * ((0.45 + density * 1.1) - 1);
  const targetCount = Math.max(1, Math.round(
    settings.siteCount * CHUNK_SIZE * CHUNK_SIZE * densityFactor,
  ));
  const minimumDistance = Math.max(18, 2 * (settings.gap + 2) + 8);
  const neighbors = neighboringAnchors(chunkX, chunkY);
  const sites = [];

  while (sites.length < targetCount) {
    let best;
    let bestDistance = -1;
    for (let attempt = 0; attempt < 360; attempt += 1) {
      const candidate = {
        x: (chunkX + random()) * CHUNK_SIZE,
        y: (chunkY + random()) * CHUNK_SIZE,
      };
      const distance = [...neighbors, ...sites].reduce(
        (nearest, site) => Math.min(nearest, pixelDistance(candidate, site)),
        Infinity,
      );
      const localDensity = densityAt(candidate.x, candidate.y, settings);
      const densityWeight = 0.22 + localDensity * 0.78;
      const score = distance * (
        1 + settings.densityVariation * (densityWeight * 1.8 - 1)
      );
      if (distance >= minimumDistance && score > bestDistance) {
        best = candidate;
        bestDistance = score;
      }
    }
    if (!best) break;
    sites.push(best);
  }

  const subdividedSites = [];
  sites.forEach((site, index) => {
    let pair;
    if (random() < settings.subdivisionChance) {
      const radius = Math.max(
        settings.subdivisionSpread * 0.5,
        minimumDistance * 0.5 + 2,
      );
      const otherSites = [
        ...neighbors,
        ...sites.filter((_, otherIndex) => otherIndex !== index),
        ...subdividedSites,
      ];
      for (let attempt = 0; attempt < 24 && !pair; attempt += 1) {
        const angle = random() * Math.PI * 2;
        const dx = Math.cos(angle) * radius / WIDTH;
        const dy = Math.sin(angle) * radius / HEIGHT;
        const candidates = [
          { x: site.x - dx, y: site.y - dy },
          { x: site.x + dx, y: site.y + dy },
        ];
        const insideChunk = candidates.every((candidate) => (
          candidate.x >= chunkX * CHUNK_SIZE
          && candidate.x <= (chunkX + 1) * CHUNK_SIZE
          && candidate.y >= chunkY * CHUNK_SIZE
          && candidate.y <= (chunkY + 1) * CHUNK_SIZE
        ));
        const clearsNeighbors = candidates.every((candidate) => (
          otherSites.every((other) => pixelDistance(candidate, other) >= minimumDistance)
        ));
        if (insideChunk && clearsNeighbors) pair = candidates;
      }
    }
    subdividedSites.push(...(pair || [site]));
  });

  const animatedSites = subdividedSites.map((site) => ({
    anchorX: site.x,
    anchorY: site.y,
    phaseX: random() * Math.PI * 2,
    phaseY: random() * Math.PI * 2,
    driftScale: 0.65 + random() * 0.7,
  }));

  chunks.set(chunkKey(chunkX, chunkY), {
    x: chunkX,
    y: chunkY,
    sites: animatedSites,
    visit,
  });
}

function chunkRange(margin) {
  return {
    startX: Math.floor((camera.x - margin) / CHUNK_SIZE),
    endX: Math.floor((camera.x + 1 + margin) / CHUNK_SIZE),
    startY: Math.floor((camera.y - margin) / CHUNK_SIZE),
    endY: Math.floor((camera.y + 1 + margin) / CHUNK_SIZE),
  };
}

function streamChunks(settings) {
  const required = chunkRange(RENDER_HALO);
  const missing = [];
  for (let y = required.startY; y <= required.endY; y += 1) {
    for (let x = required.startX; x <= required.endX; x += 1) {
      if (!chunks.has(chunkKey(x, y))) {
        const centerX = (x + 0.5) * CHUNK_SIZE;
        const centerY = (y + 0.5) * CHUNK_SIZE;
        missing.push({
          x,
          y,
          distance: Math.hypot(
            centerX - (camera.x + 0.5),
            centerY - (camera.y + 0.5),
          ),
        });
      }
    }
  }
  missing.sort((a, b) => a.distance - b.distance);
  missing.forEach((entry) => generateChunk(entry.x, entry.y, settings));

  const retained = chunkRange(RETENTION_MARGIN);
  chunks.forEach((chunk, key) => {
    if (
      chunk.x < retained.startX || chunk.x > retained.endX
      || chunk.y < retained.startY || chunk.y > retained.endY
    ) {
      chunks.delete(key);
    }
  });
}

function driftedSites(settings) {
  const amplitude = settings.turbulence * 0.03;
  const motionTime = elapsed * settings.driftSpeed;
  const sites = [];
  chunks.forEach((chunk) => chunk.sites.forEach((site) => {
    const xWave = Math.sin(motionTime * 0.72 + site.phaseX + site.anchorY * 8.7)
      + Math.cos(motionTime * 0.31 - site.phaseY + site.anchorX * 12.1) * 0.45;
    const yWave = Math.cos(motionTime * 0.61 + site.phaseY + site.anchorX * 9.3)
      + Math.sin(motionTime * 0.27 + site.phaseX - site.anchorY * 11.4) * 0.45;
    const x = site.anchorX + xWave * amplitude * site.driftScale / 1.45;
    const y = site.anchorY + yWave * amplitude * site.driftScale / 1.45;
    if (
      x >= camera.x - RENDER_HALO && x <= camera.x + 1 + RENDER_HALO
      && y >= camera.y - RENDER_HALO && y <= camera.y + 1 + RENDER_HALO
    ) {
      sites.push({ x, y, anchorX: site.anchorX, anchorY: site.anchorY });
    }
  }));

  const minimumDistance = Math.max(18, 2 * (settings.gap + 2) + 8);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let first = 0; first < sites.length; first += 1) {
      for (let second = first + 1; second < sites.length; second += 1) {
        const a = sites[first];
        const b = sites[second];
        const dx = (b.x - a.x) * WIDTH;
        const dy = (b.y - a.y) * HEIGHT;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        if (distance >= minimumDistance) continue;
        const push = (minimumDistance - distance) * 0.5;
        a.x -= dx / distance * push / WIDTH;
        a.y -= dy / distance * push / HEIGHT;
        b.x += dx / distance * push / WIDTH;
        b.y += dy / distance * push / HEIGHT;
      }
    }
  }
  return sites;
}

function screenSites(worldSites) {
  return worldSites.map((site) => ({
    x: site.x - camera.x,
    y: site.y - camera.y,
    edgeDistance: Math.hypot(
      Math.max(camera.x - site.x, 0, site.x - camera.x - 1),
      Math.max(camera.y - site.y, 0, site.y - camera.y - 1),
    ),
  })).sort((a, b) => a.edgeDistance - b.edgeDistance).slice(0, MAX_SITES);
}

function updateOutputs(settings, visibleCount) {
  const formatters = {
    densityVariation: (value) => `${Math.round(value * 100)}%`,
    densityScale: (value) => `${value}×`,
    subdivisionChance: (value) => `${Math.round(value * 100)}%`,
    subdivisionSpread: (value) => `${value} px`,
    flowDirection: (value) => `${value}°`,
    flowSpeed: (value) => `${value}×`,
    turbulence: (value) => `${Math.round(value * 100)}%`,
    driftSpeed: (value) => `${value}×`,
    hueSpeed: (value) => `${value}°/s`,
    gap: (value) => `${value} px`,
    rounding: (value) => `${value} px`,
  };
  controls.querySelectorAll("output[data-output]").forEach((output) => {
    const key = output.dataset.output;
    output.value = formatters[key] ? formatters[key](settings[key]) : settings[key];
  });
  document.querySelector("[data-cell-readout]").textContent = `${visibleCount} visible sites · ${chunks.size} chunks`;
  document.querySelector("[data-time]").textContent = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${(elapsed % 60).toFixed(1).padStart(4, "0")}`;
}

function frame(time) {
  const settings = getConfig();
  const nextSignature = `${settings.seed}:${settings.siteCount}:${settings.gap}:${settings.densityVariation}:${settings.densityScale}:${settings.subdivisionChance}:${settings.subdivisionSpread}`;
  if (nextSignature !== worldSignature) {
    resetWorld(settings);
    worldSignature = nextSignature;
  }
  const delta = previousTime === undefined ? 0 : Math.min(0.04, (time - previousTime) / 1000);
  previousTime = time;
  if (running) {
    elapsed += delta;
    const direction = settings.flowDirection * Math.PI / 180;
    camera.x += Math.cos(direction) * settings.flowSpeed * 0.06 * delta;
    camera.y += Math.sin(direction) * settings.flowSpeed * 0.06 * delta;
  }
  streamChunks(settings);
  const worldSites = driftedSites(settings);
  const renderSites = screenSites(worldSites);
  if (renderer) {
    const bounds = stage.getBoundingClientRect();
    const pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    renderer.resize(Math.round(bounds.width * pixelRatio), Math.round(bounds.height * pixelRatio));
    const hue = elapsed * settings.hueSpeed;
    renderer.render({ ...settings, pixelRatio, lineWidth: 2, softness: 1.25, pointSize: settings.showPoints ? 3 : 0, boundCanvas: false }, renderSites, {
      foreground: shiftHue(settings.foreground, hue),
      background: shiftHue(settings.background, hue * 0.38),
      line: shiftHue(settings.line, hue * 0.72),
    });
  }
  const visibleCount = worldSites.filter((site) => (
    site.x >= camera.x && site.x <= camera.x + 1
    && site.y >= camera.y && site.y <= camera.y + 1
  )).length;
  updateOutputs(settings, visibleCount);
  requestAnimationFrame(frame);
}

toggleButton.addEventListener("click", () => {
  running = !running;
  toggleButton.textContent = running ? "Pause" : "Play";
  const status = document.querySelector("[data-status]");
  status.textContent = running ? "Playing" : "Paused";
  status.classList.toggle("is-paused", !running);
});
document.querySelector("[data-reset-motion]").addEventListener("click", () => {
  const settings = getConfig();
  elapsed = 0;
  previousTime = undefined;
  resetWorld(settings, true);
  worldSignature = `${settings.seed}:${settings.siteCount}:${settings.gap}:${settings.densityVariation}:${settings.densityScale}:${settings.subdivisionChance}:${settings.subdivisionSpread}`;
});

if (!renderer) {
  document.querySelector("[data-error]").hidden = false;
  canvas.hidden = true;
} else {
  requestAnimationFrame(frame);
}
