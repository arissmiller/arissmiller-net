import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateTopographySvg } from "../projects/topography-generator/topography.js";

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(
    process.argv[index].replace(/^--/, ""),
    process.argv[index + 1],
  );
}

const numberOption = (name, fallback) => {
  const value = Number(argumentsMap.get(name));
  return Number.isFinite(value) ? value : fallback;
};

const output = resolve(
  argumentsMap.get("output") ??
    "assets/images/generated/about-topography.svg",
);
const svg = generateTopographySvg({
  width: numberOption("width", 900),
  height: numberOption("height", 300),
  seed: numberOption("seed", 4182),
  scale: numberOption("scale", 4.8),
  octaves: numberOption("octaves", 5),
  persistence: numberOption("persistence", 0.54),
  elongation: numberOption("elongation", 1.65),
  angle: numberOption("angle", -18),
  contours: numberOption("contours", 22),
  resolution: numberOption("resolution", 190),
  strokeWidth: numberOption("stroke-width", 0.72),
  background: argumentsMap.get("background") ?? "#e4e4da",
  stroke: argumentsMap.get("stroke") ?? "#101010",
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${svg}\n`, "utf8");
console.log(`Generated ${output}`);
