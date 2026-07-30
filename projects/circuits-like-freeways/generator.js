import circuitSource from "../../links/circuit-background.js?raw";

const controls = document.querySelector("[data-controls]");
const preview = document.querySelector("[data-preview]");
const codeOutput = document.querySelector("[data-code]");
const copyStatus = document.querySelector("[data-copy-status]");
const resetButton = document.querySelector("[data-reset]");
const reseedButton = document.querySelector("[data-reseed]");
const copyButtons = document.querySelectorAll("[data-copy]");

const standaloneRenderer = circuitSource.replace(
  "export function mountCircuitBackground",
  "function mountCircuitBackground",
);

const numericKeys = [
  "gridSize",
  "traceCount",
  "chipCount",
  "glow",
  "pulseCount",
  "animationSpeed",
];

function getConfig() {
  const data = new FormData(controls);
  return {
    seed: String(data.get("seed") || "flynn-1982"),
    background: String(data.get("background")),
    palette: [1, 2, 3, 4, 5].map((index) =>
      String(data.get(`color${index}`)),
    ),
    gridSize: Number(data.get("gridSize")),
    traceCount: Number(data.get("traceCount")),
    chipCount: Number(data.get("chipCount")),
    glow: Number(data.get("glow")),
    pulseCount: Number(data.get("pulseCount")),
    animationSpeed: Number(data.get("animationSpeed")),
    animated: data.has("animated"),
  };
}

function buildDocument(config) {
  const serializedConfig = JSON.stringify(config, null, 2);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Circuits Like Freeways</title>
    <style>
      * { box-sizing: border-box; }
      html, body { width: 100%; min-height: 100%; margin: 0; }
      html { background: ${config.background}; }
      body { min-height: 100vh; overflow: hidden; background: ${config.background}; }
      canvas { position: fixed; inset: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <canvas data-circuit aria-hidden="true"></canvas>
    <script>
${standaloneRenderer}

      const circuitConfig = ${serializedConfig};
      mountCircuitBackground(
        document.querySelector("[data-circuit]"),
        circuitConfig,
      );
    <\/script>
  </body>
</html>
`;
}

function syncOutputs() {
  numericKeys.forEach((key) => {
    const input = controls.elements[key];
    const output = controls.querySelector(`[data-output="${key}"]`);
    const value = Number(input.value);

    if (key === "gridSize") output.value = `${value} px`;
    else if (key === "glow") output.value = `${value.toFixed(1)}×`;
    else if (key === "animationSpeed") output.value = `${value.toFixed(2)}×`;
    else output.value = String(value);
  });
}

let generatedDocument = "";
let previewTimer;

function render({ immediate = false } = {}) {
  window.clearTimeout(previewTimer);
  syncOutputs();
  generatedDocument = buildDocument(getConfig());
  codeOutput.value = generatedDocument;

  const updatePreview = () => {
    preview.srcdoc = generatedDocument;
  };

  if (immediate) updatePreview();
  else previewTimer = window.setTimeout(updatePreview, 160);
}

function createSeed() {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(36)).join("-");
}

function fallbackCopy() {
  codeOutput.focus();
  codeOutput.select();
  codeOutput.setSelectionRange(0, codeOutput.value.length);
  return document.execCommand("copy");
}

async function copyDocument() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(generatedDocument);
    } else if (!fallbackCopy()) {
      throw new Error("Clipboard unavailable");
    }
    copyStatus.dataset.state = "success";
    copyStatus.textContent = "Copied the complete standalone HTML document.";
  } catch {
    const copied = fallbackCopy();
    copyStatus.dataset.state = copied ? "success" : "error";
    copyStatus.textContent = copied
      ? "Copied the complete standalone HTML document."
      : "Copy failed. Select the generated HTML and copy it manually.";
  }
}

controls.addEventListener("input", () => render());
controls.addEventListener("change", () => render({ immediate: true }));

resetButton.addEventListener("click", () => {
  controls.reset();
  copyStatus.dataset.state = "";
  copyStatus.textContent = "Defaults restored.";
  render({ immediate: true });
});

reseedButton.addEventListener("click", () => {
  controls.elements.seed.value = createSeed();
  copyStatus.dataset.state = "";
  copyStatus.textContent = "Generated a new circuit seed.";
  render({ immediate: true });
});

copyButtons.forEach((button) => {
  button.addEventListener("click", copyDocument);
});

render({ immediate: true });
