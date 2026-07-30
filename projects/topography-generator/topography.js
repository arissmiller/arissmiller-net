const formatNumber = (value) => Number(value.toFixed(3)).toString();

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createPerlinNoise(seed) {
  const random = seededRandom(seed);
  const values = Array.from({ length: 256 }, (_, index) => index);

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  const permutation = Array.from(
    { length: 512 },
    (_, index) => values[index & 255],
  );
  const fade = (value) =>
    value * value * value * (value * (value * 6 - 15) + 10);
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const gradient = (hash, x, y) => {
    switch (hash & 7) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      case 3:
        return -x - y;
      case 4:
        return x;
      case 5:
        return -x;
      case 6:
        return y;
      default:
        return -y;
    }
  };

  return (x, y) => {
    const xFloor = Math.floor(x);
    const yFloor = Math.floor(y);
    const xCell = xFloor & 255;
    const yCell = yFloor & 255;
    const localX = x - xFloor;
    const localY = y - yFloor;
    const u = fade(localX);
    const v = fade(localY);
    const aa = permutation[permutation[xCell] + yCell];
    const ab = permutation[permutation[xCell] + yCell + 1];
    const ba = permutation[permutation[xCell + 1] + yCell];
    const bb = permutation[permutation[xCell + 1] + yCell + 1];

    return lerp(
      lerp(
        gradient(aa, localX, localY),
        gradient(ba, localX - 1, localY),
        u,
      ),
      lerp(
        gradient(ab, localX, localY - 1),
        gradient(bb, localX - 1, localY - 1),
        u,
      ),
      v,
    );
  };
}

function sampleField(config) {
  const noise = createPerlinNoise(config.seed);
  const angle = (config.angle * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const inverseElongation = 1 / Math.max(config.elongation, 0.001);
  const columns = config.resolution;
  const rows = Math.max(
    12,
    Math.round(columns * (config.height / config.width)),
  );
  const values = Array.from({ length: rows + 1 }, () =>
    Array(columns + 1).fill(0),
  );
  let minimum = Infinity;
  let maximum = -Infinity;

  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const worldX = (column / columns - 0.5) * config.scale;
      const worldY =
        (row / rows - 0.5) *
        config.scale *
        (config.height / config.width);
      const rotatedX = worldX * cosine - worldY * sine;
      const rotatedY = worldX * sine + worldY * cosine;
      const x = rotatedX * inverseElongation;
      const y = rotatedY;
      let amplitude = 1;
      let frequency = 1;
      let total = 0;
      let amplitudeTotal = 0;

      for (let octave = 0; octave < config.octaves; octave += 1) {
        total +=
          noise(
            x * frequency + octave * 13.17,
            y * frequency - octave * 7.31,
          ) * amplitude;
        amplitudeTotal += amplitude;
        amplitude *= config.persistence;
        frequency *= 2;
      }

      const value = total / amplitudeTotal;
      values[row][column] = value;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }

  return { values, columns, rows, minimum, maximum };
}

function interpolate(first, second, threshold) {
  if (Math.abs(second.value - first.value) < 0.000001) {
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  }

  const amount = (threshold - first.value) / (second.value - first.value);
  return {
    x: first.x + (second.x - first.x) * amount,
    y: first.y + (second.y - first.y) * amount,
  };
}

function segmentsForLevel(field, threshold, width, height) {
  const { values, columns, rows } = field;
  const segments = [];
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const topLeft = {
        x: column * cellWidth,
        y: row * cellHeight,
        value: values[row][column],
      };
      const topRight = {
        x: (column + 1) * cellWidth,
        y: row * cellHeight,
        value: values[row][column + 1],
      };
      const bottomRight = {
        x: (column + 1) * cellWidth,
        y: (row + 1) * cellHeight,
        value: values[row + 1][column + 1],
      };
      const bottomLeft = {
        x: column * cellWidth,
        y: (row + 1) * cellHeight,
        value: values[row + 1][column],
      };
      const crossings = [];

      if ((topLeft.value >= threshold) !== (topRight.value >= threshold)) {
        crossings.push(interpolate(topLeft, topRight, threshold));
      }
      if ((topRight.value >= threshold) !== (bottomRight.value >= threshold)) {
        crossings.push(interpolate(topRight, bottomRight, threshold));
      }
      if ((bottomRight.value >= threshold) !== (bottomLeft.value >= threshold)) {
        crossings.push(interpolate(bottomRight, bottomLeft, threshold));
      }
      if ((bottomLeft.value >= threshold) !== (topLeft.value >= threshold)) {
        crossings.push(interpolate(bottomLeft, topLeft, threshold));
      }

      if (crossings.length === 2) {
        segments.push(crossings);
      } else if (crossings.length === 4) {
        const center =
          (topLeft.value +
            topRight.value +
            bottomRight.value +
            bottomLeft.value) /
          4;
        const pairing =
          center >= threshold
            ? [
                [crossings[0], crossings[3]],
                [crossings[1], crossings[2]],
              ]
            : [
                [crossings[0], crossings[1]],
                [crossings[2], crossings[3]],
              ];
        segments.push(...pairing);
      }
    }
  }

  return segments;
}

function stitchSegments(segments) {
  const keyForPoint = (point) =>
    `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  const connections = new Map();
  const used = Array(segments.length).fill(false);

  segments.forEach((segment, segmentIndex) => {
    segment.forEach((point) => {
      const key = keyForPoint(point);
      const entries = connections.get(key) ?? [];
      entries.push(segmentIndex);
      connections.set(key, entries);
    });
  });

  const nextUnusedSegment = (point) =>
    (connections.get(keyForPoint(point)) ?? []).find(
      (segmentIndex) => !used[segmentIndex],
    );
  const otherPoint = (segment, point) =>
    keyForPoint(segment[0]) === keyForPoint(point)
      ? segment[1]
      : segment[0];
  const lines = [];

  segments.forEach((segment, segmentIndex) => {
    if (used[segmentIndex]) return;
    used[segmentIndex] = true;
    const line = [segment[0], segment[1]];

    let nextIndex = nextUnusedSegment(line.at(-1));
    while (nextIndex !== undefined) {
      used[nextIndex] = true;
      line.push(otherPoint(segments[nextIndex], line.at(-1)));
      nextIndex = nextUnusedSegment(line.at(-1));
    }

    nextIndex = nextUnusedSegment(line[0]);
    while (nextIndex !== undefined) {
      used[nextIndex] = true;
      line.unshift(otherPoint(segments[nextIndex], line[0]));
      nextIndex = nextUnusedSegment(line[0]);
    }

    lines.push(line);
  });

  return lines;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

export function generateTopographySvg(options = {}) {
  const config = {
    width: 900,
    height: 360,
    seed: 4182,
    scale: 3.2,
    octaves: 4,
    persistence: 0.52,
    elongation: 1,
    angle: 0,
    contours: 16,
    resolution: 150,
    background: "#f1f0e7",
    stroke: "#111111",
    strokeWidth: 0.9,
    ...options,
  };
  const field = sampleField(config);
  const low = field.minimum + (field.maximum - field.minimum) * 0.12;
  const high = field.minimum + (field.maximum - field.minimum) * 0.88;
  const paths = [];

  for (let index = 0; index < config.contours; index += 1) {
    const threshold =
      low + (high - low) * ((index + 1) / (config.contours + 1));
    const segments = segmentsForLevel(
      field,
      threshold,
      config.width,
      config.height,
    );
    const definition = stitchSegments(segments)
      .map(
        (line) =>
          `M${line
            .map(
              (point) =>
                `${formatNumber(point.x)} ${formatNumber(point.y)}`,
            )
            .join("L")}`,
      )
      .join("");
    const major = (index + 1) % 4 === 0;

    if (definition) {
      paths.push(
        `<path d="${definition}" fill="none" stroke="${escapeAttribute(config.stroke)}" stroke-width="${formatNumber(config.strokeWidth * (major ? 1.55 : 1))}" stroke-opacity="${major ? "0.95" : "0.62"}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
      );
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${config.height}" viewBox="0 0 ${config.width} ${config.height}">`,
    `<rect width="100%" height="100%" fill="${escapeAttribute(config.background)}"/>`,
    ...paths,
    "</svg>",
  ].join("");
}

export const topographyDefaults = Object.freeze({
  width: 900,
  height: 360,
  seed: 4182,
  scale: 3.2,
  octaves: 4,
  persistence: 0.52,
  elongation: 1,
  angle: 0,
  contours: 16,
  resolution: 150,
  background: "#f1f0e7",
  stroke: "#111111",
  strokeWidth: 0.9,
});
