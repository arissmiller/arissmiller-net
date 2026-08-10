const canvas = document.querySelector("[data-canvas]");
const context = canvas.getContext("2d");
const stage = document.querySelector("[data-stage]");
const toggle = document.querySelector("[data-toggle]");
const toggleIcon = document.querySelector("[data-toggle-icon]");
const elevationOutput = document.querySelector("[data-elevation]");
const progress = document.querySelector("[data-readout-progress]");
const seedOutput = document.querySelector("[data-seed]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const palettes = {
  glacier: { background: "#020405", line: "121, 187, 165", bright: "190, 255, 234", glow: "82, 255, 199" },
  ultraviolet: { background: "#05020a", line: "145, 119, 181", bright: "231, 211, 255", glow: "176, 95, 255" },
  ember: { background: "#080302", line: "183, 119, 83", bright: "255, 221, 185", glow: "255, 103, 42" },
  sonar: { background: "#010508", line: "89, 151, 174", bright: "197, 239, 255", glow: "37, 186, 255" },
  acid: { background: "#030501", line: "155, 178, 91", bright: "234, 255, 181", glow: "188, 255, 31" },
};

let width = 0;
let height = 0;
let columns = 0;
let rows = 0;
let values = new Float32Array();
let seed = 4182;
let noise = createPerlinNoise(seed);
let elapsed = 0;
let previousTime = 0;
let running = !reducedMotion.matches;
let frameRequest = 0;
let palette = palettes.glacier;

const settings = { contours: 18, scale: 3.2, morph: 0.16, climb: 0.11, glow: 0.72 };
const inputs = [...document.querySelectorAll('input[type="range"]')];

function seededRandom(initialSeed) {
  let state = initialSeed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createPerlinNoise(initialSeed) {
  const random = seededRandom(initialSeed);
  const source = Array.from({ length: 256 }, (_, index) => index);
  for (let index = 255; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [source[index], source[swap]] = [source[swap], source[index]];
  }
  const permutation = Array.from({ length: 512 }, (_, index) => source[index & 255]);
  const fade = (value) => value ** 3 * (value * (value * 6 - 15) + 10);
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const gradient = (hash, x, y, z) => {
    const first = (hash & 15) < 8 ? x : y;
    const second = (hash & 15) < 4 ? y : ((hash & 15) === 12 || (hash & 15) === 14 ? x : z);
    return ((hash & 1) ? -first : first) + ((hash & 2) ? -second : second);
  };

  return (x, y, z) => {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const floorZ = Math.floor(z);
    const cellX = floorX & 255;
    const cellY = floorY & 255;
    const cellZ = floorZ & 255;
    const localX = x - floorX;
    const localY = y - floorY;
    const localZ = z - floorZ;
    const u = fade(localX);
    const v = fade(localY);
    const w = fade(localZ);
    const a = permutation[cellX] + cellY;
    const aa = permutation[a] + cellZ;
    const ab = permutation[a + 1] + cellZ;
    const b = permutation[cellX + 1] + cellY;
    const ba = permutation[b] + cellZ;
    const bb = permutation[b + 1] + cellZ;

    return lerp(
      lerp(lerp(gradient(permutation[aa], localX, localY, localZ), gradient(permutation[ba], localX - 1, localY, localZ), u), lerp(gradient(permutation[ab], localX, localY - 1, localZ), gradient(permutation[bb], localX - 1, localY - 1, localZ), u), v),
      lerp(lerp(gradient(permutation[aa + 1], localX, localY, localZ - 1), gradient(permutation[ba + 1], localX - 1, localY, localZ - 1), u), lerp(gradient(permutation[ab + 1], localX, localY - 1, localZ - 1), gradient(permutation[bb + 1], localX - 1, localY - 1, localZ - 1), u), v),
      w,
    );
  };
}

function resize() {
  const bounds = stage.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  columns = Math.max(64, Math.min(150, Math.round(width / 10)));
  rows = Math.max(42, Math.round(columns * height / width));
  values = new Float32Array((columns + 1) * (rows + 1));
  draw();
}

function sampleTerrain() {
  const aspect = width / height;
  const time = elapsed * settings.morph;
  let minimum = Infinity;
  let maximum = -Infinity;

  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const x = (column / columns - 0.5) * settings.scale * aspect;
      const y = (row / rows - 0.5) * settings.scale;
      let amplitude = 1;
      let frequency = 1;
      let total = 0;
      let amplitudeTotal = 0;
      for (let octave = 0; octave < 5; octave += 1) {
        total += noise(x * frequency + octave * 7.13, y * frequency - octave * 4.71, time + octave * 2.37) * amplitude;
        amplitudeTotal += amplitude;
        amplitude *= 0.5;
        frequency *= 2.02;
      }
      const index = row * (columns + 1) + column;
      const value = total / amplitudeTotal;
      values[index] = value;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }

  const span = Math.max(0.001, maximum - minimum);
  for (let index = 0; index < values.length; index += 1) values[index] = (values[index] - minimum) / span;
}

function edgePoint(edge, column, row, threshold) {
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const index = row * (columns + 1) + column;
  const topLeft = values[index];
  const topRight = values[index + 1];
  const bottomLeft = values[index + columns + 1];
  const bottomRight = values[index + columns + 2];
  const interpolate = (first, second) => Math.abs(second - first) < 0.00001 ? 0.5 : (threshold - first) / (second - first);
  if (edge === 0) return [(column + interpolate(topLeft, topRight)) * cellWidth, row * cellHeight];
  if (edge === 1) return [(column + 1) * cellWidth, (row + interpolate(topRight, bottomRight)) * cellHeight];
  if (edge === 2) return [(column + interpolate(bottomLeft, bottomRight)) * cellWidth, (row + 1) * cellHeight];
  return [column * cellWidth, (row + interpolate(topLeft, bottomLeft)) * cellHeight];
}

const segmentTable = {
  1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]],
  6: [[0, 2]], 7: [[3, 2]], 8: [[2, 3]], 9: [[0, 2]],
  11: [[1, 2]], 12: [[1, 3]], 13: [[0, 1]], 14: [[3, 0]],
};

function pathForLevel(threshold) {
  const path = new Path2D();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * (columns + 1) + column;
      const topLeft = values[index];
      const topRight = values[index + 1];
      const bottomLeft = values[index + columns + 1];
      const bottomRight = values[index + columns + 2];
      const state = (topLeft >= threshold ? 1 : 0) | (topRight >= threshold ? 2 : 0) | (bottomRight >= threshold ? 4 : 0) | (bottomLeft >= threshold ? 8 : 0);
      let segments = segmentTable[state];
      if (state === 5 || state === 10) {
        const center = (topLeft + topRight + bottomRight + bottomLeft) * 0.25;
        segments = state === 5
          ? (center >= threshold ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]])
          : (center >= threshold ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]]);
      }
      if (!segments) continue;
      for (const [firstEdge, secondEdge] of segments) {
        const first = edgePoint(firstEdge, column, row, threshold);
        const second = edgePoint(secondEdge, column, row, threshold);
        path.moveTo(first[0], first[1]);
        path.lineTo(second[0], second[1]);
      }
    }
  }
  return path;
}

function strokePath(path, intensity) {
  if (intensity > 0.035) {
    context.save();
    context.strokeStyle = `rgba(${palette.glow}, ${0.12 * intensity * settings.glow})`;
    context.lineWidth = 10 + intensity * 12;
    context.filter = `blur(${4 + intensity * 5}px)`;
    context.stroke(path);
    context.restore();
  }
  context.strokeStyle = intensity > 0.02
    ? `rgba(${palette.bright}, ${0.15 + intensity * 0.82})`
    : `rgba(${palette.line}, 0.105)`;
  context.lineWidth = intensity > 0.02 ? 0.55 + intensity * 1.05 : 0.55;
  context.stroke(path);
}

function draw() {
  if (!width || !height) return;
  sampleTerrain();
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";

  const low = 0.1;
  const high = 0.9;
  const sweep = low + ((elapsed * settings.climb) % 1) * (high - low);
  const count = settings.contours;
  const bandWidth = Math.max(0.06, 2.5 / count);

  for (let level = 1; level <= count; level += 1) {
    const threshold = low + (level / (count + 1)) * (high - low);
    const distance = Math.abs(threshold - sweep);
    const intensity = Math.exp(-((distance / bandWidth) ** 2) * 2.3);
    strokePath(pathForLevel(threshold), intensity);
  }

  const normalized = (sweep - low) / (high - low);
  elevationOutput.textContent = `${String(Math.round(normalized * 2840)).padStart(4, "0")} m`;
  progress.style.width = `${normalized * 100}%`;
}

function animate(time) {
  const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
  previousTime = time;
  if (running && !document.hidden) {
    elapsed += delta;
    draw();
  }
  frameRequest = requestAnimationFrame(animate);
}

function updateToggle() {
  toggleIcon.textContent = running ? "Ⅱ" : "▶";
  toggle.setAttribute("aria-label", running ? "Pause animation" : "Play animation");
}

inputs.forEach((input) => {
  const output = document.querySelector(`[data-output="${input.name}"]`);
  const format = { contours: (value) => value, scale: (value) => `${value}×`, morph: (value) => `${value}×`, climb: (value) => `${value}×`, glow: (value) => `${Math.round(value * 100)}%` }[input.name];
  input.addEventListener("input", () => {
    settings[input.name] = Number(input.value);
    output.value = format(settings[input.name]);
    if (!running) draw();
  });
});

document.querySelectorAll('input[name="palette"]').forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    palette = palettes[input.value];
    stage.dataset.scheme = input.value;
    draw();
  });
});

toggle.addEventListener("click", () => { running = !running; previousTime = 0; updateToggle(); });
document.querySelector("[data-randomize]").addEventListener("click", () => {
  seed = Math.floor(Math.random() * 999999);
  noise = createPerlinNoise(seed);
  elapsed = 0;
  seedOutput.textContent = `Seed ${seed}`;
  draw();
});
reducedMotion.addEventListener("change", (event) => { running = !event.matches; previousTime = 0; updateToggle(); });
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => { previousTime = 0; });

resize();
updateToggle();
cancelAnimationFrame(frameRequest);
frameRequest = requestAnimationFrame(animate);
