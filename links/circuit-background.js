const DEFAULT_PALETTE = [
  "#00e5ff",
  "#ff63d8",
  "#ffbf3f",
  "#b8ff3d",
  "#b578ff",
];

function hashSeed(value) {
  let hash = 2166136261;

  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed) {
  let state = hashSeed(seed) || 1;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(random, minimum, maximum) {
  return minimum + random() * (maximum - minimum);
}

function randomInteger(random, minimum, maximum) {
  return Math.floor(randomBetween(random, minimum, maximum + 1));
}

function choose(random, items) {
  return items[randomInteger(random, 0, items.length - 1)];
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const parsed = Number.parseInt(value, 16);
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createTrace(random, width, height, grid, palette) {
  const edge = randomInteger(random, 0, 3);
  let x;
  let y;
  let direction;

  if (edge === 0 || edge === 2) {
    x = Math.round(randomBetween(random, 0, width) / grid) * grid;
    y = edge === 0 ? -grid : height + grid;
    direction = edge === 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    x = edge === 1 ? width + grid : -grid;
    y = Math.round(randomBetween(random, 0, height) / grid) * grid;
    direction = edge === 1 ? Math.PI : 0;
  }

  const points = [{ x, y }];
  const segmentCount = randomInteger(random, 3, 8);
  const turnAngles = [-Math.PI / 4, 0, Math.PI / 4];

  for (let index = 0; index < segmentCount; index += 1) {
    direction += choose(random, turnAngles);
    const step = grid * randomInteger(random, 2, 7);
    x += Math.cos(direction) * step;
    y += Math.sin(direction) * step;
    points.push({
      x: Math.round(x * 2) / 2,
      y: Math.round(y * 2) / 2,
    });
  }

  let totalLength = 0;
  const lengths = [0];

  for (let index = 1; index < points.length; index += 1) {
    totalLength += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
    lengths.push(totalLength);
  }

  return {
    color: choose(random, palette),
    lengths,
    points,
    totalLength,
    width: random() > 0.88 ? 1.5 : 0.75,
  };
}

function createChip(random, width, height, grid, palette) {
  const maximumColumns = Math.max(
    1,
    Math.min(7, Math.floor(width / grid) - 2),
  );
  const maximumRows = Math.max(
    1,
    Math.min(5, Math.floor(height / grid) - 2),
  );
  const chipWidth =
    grid * randomInteger(random, Math.min(3, maximumColumns), maximumColumns);
  const chipHeight =
    grid * randomInteger(random, Math.min(2, maximumRows), maximumRows);
  const maximumX = Math.max(grid, width - chipWidth - grid);
  const maximumY = Math.max(grid, height - chipHeight - grid);
  return {
    x: Math.round(randomBetween(random, grid, maximumX) / grid) * grid,
    y: Math.round(randomBetween(random, grid, maximumY) / grid) * grid,
    width: chipWidth,
    height: chipHeight,
    color: choose(random, palette),
    horizontalPins: randomInteger(random, 2, 5),
    verticalPins: randomInteger(random, 1, 3),
  };
}

function pointAlongTrace(trace, distance) {
  const target = ((distance % trace.totalLength) + trace.totalLength) % trace.totalLength;

  for (let index = 1; index < trace.lengths.length; index += 1) {
    if (trace.lengths[index] < target) continue;

    const segmentStart = trace.lengths[index - 1];
    const segmentLength = trace.lengths[index] - segmentStart;
    const progress = segmentLength === 0 ? 0 : (target - segmentStart) / segmentLength;
    const start = trace.points[index - 1];
    const end = trace.points[index];
    return {
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    };
  }

  return trace.points.at(-1);
}

function drawTrace(context, trace, glow) {
  context.beginPath();
  trace.points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = hexToRgba(trace.color, 0.12 + glow * 0.08);
  context.lineWidth = trace.width + 1 + glow * 2;
  context.stroke();
  context.strokeStyle = hexToRgba(trace.color, 0.52);
  context.lineWidth = trace.width;
  context.stroke();

  trace.points.slice(1, -1).forEach((point, index) => {
    if (index % 2 !== 0) return;
    context.beginPath();
    context.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
    context.fillStyle = "#090c12";
    context.fill();
    context.strokeStyle = hexToRgba(trace.color, 0.62);
    context.lineWidth = 0.8;
    context.stroke();
  });
}

function drawChip(context, chip, glow) {
  context.save();
  context.shadowColor = hexToRgba(chip.color, 0.24);
  context.shadowBlur = glow * 10;
  context.fillStyle = "rgba(7, 10, 15, 0.94)";
  context.strokeStyle = hexToRgba(chip.color, 0.48);
  context.lineWidth = 0.8;
  context.fillRect(chip.x, chip.y, chip.width, chip.height);
  context.strokeRect(chip.x + 0.5, chip.y + 0.5, chip.width - 1, chip.height - 1);
  context.shadowBlur = 0;

  context.strokeStyle = hexToRgba(chip.color, 0.34);
  context.lineWidth = 0.75;

  for (let index = 1; index <= chip.horizontalPins; index += 1) {
    const y = chip.y + (chip.height / (chip.horizontalPins + 1)) * index;
    context.beginPath();
    context.moveTo(chip.x - 7, y);
    context.lineTo(chip.x, y);
    context.moveTo(chip.x + chip.width, y);
    context.lineTo(chip.x + chip.width + 7, y);
    context.stroke();
  }

  for (let index = 1; index <= chip.verticalPins; index += 1) {
    const x = chip.x + (chip.width / (chip.verticalPins + 1)) * index;
    context.beginPath();
    context.moveTo(x, chip.y - 7);
    context.lineTo(x, chip.y);
    context.moveTo(x, chip.y + chip.height);
    context.lineTo(x, chip.y + chip.height + 7);
    context.stroke();
  }

  context.fillStyle = hexToRgba(chip.color, 0.72);
  context.fillRect(chip.x + 7, chip.y + 7, 3, 3);
  context.restore();
}

function drawBoard(
  context,
  width,
  height,
  traces,
  chips,
  grid,
  background,
  glow,
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(184, 205, 229, 0.07)";
  for (let y = grid; y < height; y += grid) {
    for (let x = grid; x < width; x += grid) {
      context.fillRect(x, y, 0.75, 0.75);
    }
  }

  traces.forEach((trace) => drawTrace(context, trace, glow));
  chips.forEach((chip) => drawChip(context, chip, glow));
}

export function mountCircuitBackground(canvas, options = {}) {
  if (!(canvas instanceof HTMLCanvasElement)) return () => {};

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return () => {};

  const numberOption = (name, fallback) => {
    const value = Number(options[name]);
    return options[name] !== undefined && Number.isFinite(value)
      ? value
      : fallback;
  };
  const palette = options.palette ?? DEFAULT_PALETTE;
  const seed = options.seed ?? "interesting-things";
  const background = options.background ?? "#07090d";
  const animationSpeed = Math.max(0.1, numberOption("animationSpeed", 1));
  const glow = Math.max(0, Math.min(2, numberOption("glow", 1)));
  const animated = options.animated !== false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const staticLayer = document.createElement("canvas");
  const staticContext = staticLayer.getContext("2d", { alpha: false });
  let traces = [];
  let pulses = [];
  let frame;
  let resizeTimer;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let previousTime = 0;

  const stopAnimation = () => {
    window.cancelAnimationFrame(frame);
    frame = undefined;
  };

  const drawFrame = (time = 0) => {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(staticLayer, 0, 0);

    if (!reducedMotion.matches && animated) {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.globalCompositeOperation = "screen";

      pulses.forEach((pulse) => {
        const point = pointAlongTrace(
          pulse.trace,
          pulse.offset + time * pulse.speed,
        );
        context.save();
        context.shadowColor = pulse.trace.color;
        context.shadowBlur = 7 + glow * 7;
        context.fillStyle = hexToRgba(pulse.trace.color, 0.88);
        context.beginPath();
        context.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
        context.fill();
        context.restore();
      });

      context.globalCompositeOperation = "source-over";
    }

    previousTime = time;

    if (!document.hidden && !reducedMotion.matches && animated) {
      frame = window.requestAnimationFrame(drawFrame);
    }
  };

  const rebuild = () => {
    stopAnimation();
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      Math.max(1, numberOption("pixelRatioLimit", 2)),
    );

    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    staticLayer.width = canvas.width;
    staticLayer.height = canvas.height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const grid = Math.max(
      16,
      Math.min(64, numberOption("gridSize", width < 700 ? 24 : 30)),
    );
    const area = width * height;
    const random = createRandom(`${seed}:${Math.round(width / grid)}:${Math.round(height / grid)}`);
    const traceCount = Math.max(
      8,
      Math.min(
        180,
        numberOption(
          "traceCount",
          Math.max(38, Math.min(110, Math.round(area / 18000))),
        ),
      ),
    );
    const chipCount = Math.max(
      0,
      Math.min(
        30,
        numberOption(
          "chipCount",
          Math.max(5, Math.min(16, Math.round(area / 110000))),
        ),
      ),
    );

    traces = Array.from({ length: traceCount }, () =>
      createTrace(random, width, height, grid, palette),
    );
    const chips = Array.from({ length: chipCount }, () =>
      createChip(random, width, height, grid, palette),
    );
    const requestedPulseCount = Math.max(
      0,
      Math.min(24, numberOption("pulseCount", 12)),
    );
    const pulseStep =
      requestedPulseCount === 0
        ? Number.POSITIVE_INFINITY
        : Math.max(1, Math.floor(traceCount / requestedPulseCount));
    pulses = traces
      .filter((_, index) => index % pulseStep === 0)
      .slice(0, requestedPulseCount)
      .map((trace) => ({
        trace,
        offset: randomBetween(random, 0, trace.totalLength),
        speed:
          randomBetween(random, 0.018, 0.045) * animationSpeed,
      }));

    staticContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawBoard(
      staticContext,
      width,
      height,
      traces,
      chips,
      grid,
      background,
      glow,
    );
    drawFrame(previousTime);
  };

  const handleResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(rebuild, 160);
  };

  const handleVisibility = () => {
    if (document.hidden) {
      stopAnimation();
    } else {
      drawFrame(previousTime);
    }
  };

  const handleMotionPreference = () => {
    if (reducedMotion.matches || !animated) stopAnimation();
    drawFrame(previousTime);
  };

  window.addEventListener("resize", handleResize, { passive: true });
  document.addEventListener("visibilitychange", handleVisibility);
  reducedMotion.addEventListener("change", handleMotionPreference);
  rebuild();

  return () => {
    stopAnimation();
    window.clearTimeout(resizeTimer);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibility);
    reducedMotion.removeEventListener("change", handleMotionPreference);
  };
}
