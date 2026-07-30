import {
  generateTopographySvg,
  topographyDefaults,
} from "./topography.js";

const controls = document.querySelector("[data-controls]");
const preview = document.querySelector("[data-preview]");
const seedReadout = document.querySelector("[data-seed-readout]");
const toast = document.querySelector("[data-toast]");
let currentSvg = "";
let renderFrame;
let toastTimer;

function getConfig() {
  const data = new FormData(controls);
  return {
    ...topographyDefaults,
    seed: Number(data.get("seed")),
    scale: Number(data.get("scale")),
    octaves: Number(data.get("octaves")),
    persistence: Number(data.get("persistence")),
    elongation: Number(data.get("elongation")),
    angle: Number(data.get("angle")),
    contours: Number(data.get("contours")),
    resolution: Number(data.get("resolution")),
    background: data.get("background"),
    stroke: data.get("stroke"),
    strokeWidth: Number(data.get("strokeWidth")),
  };
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1800);
}

function render() {
  const config = getConfig();
  currentSvg = generateTopographySvg(config);
  preview.innerHTML = currentSvg;
  seedReadout.textContent = `Seed ${config.seed}`;

  controls.querySelectorAll("output[data-output]").forEach((output) => {
    const key = output.dataset.output;
    const suffix = key === "angle" ? "°" : "";
    output.value = `${controls.elements[key].value}${suffix}`;
  });
}

function scheduleRender() {
  window.cancelAnimationFrame(renderFrame);
  renderFrame = window.requestAnimationFrame(render);
}

function downloadSvg() {
  const blob = new Blob([currentSvg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `topography-${controls.elements.seed.value}.svg`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("SVG downloaded");
}

controls.addEventListener("input", scheduleRender);

document.querySelector("[data-randomize]").addEventListener("click", () => {
  controls.elements.seed.value = String(
    Math.floor(Math.random() * 1_000_000),
  );
  render();
});

document.querySelector("[data-download]").addEventListener("click", downloadSvg);

document.querySelector("[data-copy]").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentSvg);
    showToast("SVG copied");
  } catch {
    showToast("Clipboard unavailable");
  }
});

render();
