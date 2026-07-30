const controls = document.querySelector("[data-controls]");
const preview = document.querySelector("[data-preview]");
const codeOutput = document.querySelector("[data-code]");
const copyStatus = document.querySelector("[data-copy-status]");
const resetButton = document.querySelector("[data-reset]");
const copyButtons = document.querySelectorAll("[data-copy]");
const fixedColorControl = document.querySelector("[data-fixed-color-control]");

const numericKeys = [
  "baseSpacing",
  "coarseInterval",
  "fineWidth",
  "coarseWidth",
  "fineOpacity",
  "coarseOpacity",
  "routeWidth",
  "routeSpeed",
  "trailDuration",
  "spawnInterval",
  "maxRoutes",
  "markerSize",
];

const clampInput = (input) => {
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const fallback = Number(input.defaultValue);
  const number = Number(input.value);
  const value = Number.isFinite(number) ? number : fallback;
  const clamped = Math.min(maximum, Math.max(minimum, value));

  input.value = String(clamped);
  return clamped;
};

const getConfig = () => {
  const formData = new FormData(controls);
  const config = {
    backgroundColor: controls.elements.backgroundColor.value,
    coarseColor: controls.elements.coarseColor.value,
    fineColor: controls.elements.fineColor.value,
    routeColor: controls.elements.routeColor.value,
    gridStyle: formData.get("gridStyle"),
    routeStyle: formData.get("routeStyle"),
    routeColorMode: formData.get("routeColorMode"),
    markerShape: formData.get("markerShape"),
  };

  numericKeys.forEach((key) => {
    config[key] = clampInput(controls.elements[key]);
  });

  return config;
};

const formatNumber = (value) =>
  Number(value.toFixed(4)).toString();

const gridLineAttributes = (style, spacing) => {
  if (style === "dashed") {
    return `stroke-linecap="butt" stroke-dasharray="${formatNumber(
      spacing * 0.12,
    )} ${formatNumber(spacing * 0.09)}"`;
  }

  if (style === "dotted") {
    return `stroke-linecap="round" stroke-dasharray="0.01 ${formatNumber(
      spacing * 0.13,
    )}"`;
  }

  return 'stroke-linecap="butt"';
};

const makeGridDataUri = ({
  width,
  color,
  lineWidth,
  opacity,
  style,
}) => {
  const height = width * Math.tan(Math.PI / 6);
  const halfWidth = width / 2;
  const bleed = Math.max(2, lineWidth * 2);
  const diagonalBleed = bleed * Math.tan(Math.PI / 6);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(
      width,
    )}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(
      width,
    )} ${formatNumber(height)}">`,
    `<path d="M0 -${formatNumber(bleed)}V${formatNumber(
      height + bleed,
    )}M${formatNumber(
      halfWidth,
    )} -${formatNumber(bleed)}V${formatNumber(
      height + bleed,
    )}M${formatNumber(width)} -${formatNumber(bleed)}V${formatNumber(
      height + bleed,
    )}M-${formatNumber(bleed)} -${formatNumber(
      diagonalBleed,
    )}L${formatNumber(width + bleed)} ${formatNumber(
      height + diagonalBleed,
    )}M-${formatNumber(bleed)} ${formatNumber(
      height + diagonalBleed,
    )}L${formatNumber(width + bleed)} -${formatNumber(
      diagonalBleed,
    )}" fill="none" stroke="${color}" stroke-opacity="${formatNumber(
      opacity,
    )}" stroke-width="${formatNumber(lineWidth)}" ${gridLineAttributes(
      style,
      width,
    )}/></svg>`,
  ].join("");

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const routeDashArray = (style) => {
  if (style === "dashed") return "6 7";
  if (style === "dotted") return "0.01 7";
  return "none";
};

function routeRuntime(config) {
  const svg = document.querySelector("[data-route-field]");
  const defs = svg.querySelector("[data-route-defs]");
  const routeLayer = svg.querySelector("[data-routes]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const gridX = config.baseSpacing / 2;
  const gridY = (config.baseSpacing * Math.tan(Math.PI / 6)) / 2;
  const regionColumns = 4;
  const regionRows = 3;
  const directions = [
    { x: 0, y: -gridY * 2 },
    { x: gridX, y: -gridY },
    { x: gridX, y: gridY },
    { x: 0, y: gridY * 2 },
    { x: -gridX, y: gridY },
    { x: -gridX, y: -gridY },
  ];

  let activeRoutes = 0;
  let routeNumber = 0;
  let spawnTimer;
  let regionQueue = [];
  let previousRegion;

  const randomBetween = (minimum, maximum) =>
    minimum + Math.random() * (maximum - minimum);

  const randomInteger = (minimum, maximum) =>
    Math.floor(randomBetween(minimum, maximum + 1));

  const shuffle = (items) => {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const otherIndex = randomInteger(0, index);
      [items[index], items[otherIndex]] = [
        items[otherIndex],
        items[index],
      ];
    }

    return items;
  };

  const nextRegion = () => {
    if (regionQueue.length === 0) {
      regionQueue = shuffle(
        Array.from(
          { length: regionColumns * regionRows },
          (_, index) => index,
        ),
      );

      if (
        regionQueue.length > 1 &&
        regionQueue.at(-1) === previousRegion
      ) {
        [regionQueue[0], regionQueue[regionQueue.length - 1]] = [
          regionQueue.at(-1),
          regionQueue[0],
        ];
      }
    }

    previousRegion = regionQueue.pop();
    return previousRegion;
  };

  const makeSvgElement = (name, attributes = {}) => {
    const element = document.createElementNS(svgNamespace, name);

    Object.entries(attributes).forEach(([attribute, value]) => {
      element.setAttribute(attribute, value);
    });

    return element;
  };

  const setViewport = () => {
    svg.setAttribute(
      "viewBox",
      `0 0 ${window.innerWidth} ${window.innerHeight}`,
    );
  };

  const clearRoutes = () => {
    window.clearTimeout(spawnTimer);
    routeLayer.replaceChildren();
    defs.replaceChildren();
    activeRoutes = 0;
    regionQueue = [];
    previousRegion = undefined;
  };

  const chooseNewDirection = (currentDirection) => {
    const choices = directions.filter(
      (direction) =>
        direction !== currentDirection &&
        !(
          direction.x === -currentDirection.x &&
          direction.y === -currentDirection.y
        ),
    );

    return choices[randomInteger(0, choices.length - 1)];
  };

  const createRoutePoints = () => {
    const region = nextRegion();
    const regionColumn = region % regionColumns;
    const regionRow = Math.floor(region / regionColumns);
    const regionLeft =
      (regionColumn / regionColumns) * window.innerWidth;
    const regionRight =
      ((regionColumn + 1) / regionColumns) * window.innerWidth;
    const regionTop = (regionRow / regionRows) * window.innerHeight;
    const regionBottom =
      ((regionRow + 1) / regionRows) * window.innerHeight;
    const minimumColumn = Math.ceil(regionLeft / gridX);
    const maximumColumn = Math.floor(regionRight / gridX);
    const column = randomInteger(
      minimumColumn,
      Math.max(minimumColumn, maximumColumn),
    );
    const rowOffset = (column % 2) * gridY;
    const minimumRow = Math.ceil(
      (regionTop - rowOffset) / (gridY * 2),
    );
    const maximumRow = Math.floor(
      (regionBottom - rowOffset) / (gridY * 2),
    );
    const row = randomInteger(
      minimumRow,
      Math.max(minimumRow, maximumRow),
    );
    const points = [
      {
        x: column * gridX,
        y: row * gridY * 2 + (column % 2) * gridY,
      },
    ];
    const segmentCount = randomInteger(4, 8);
    let direction = directions[randomInteger(0, directions.length - 1)];

    for (let segment = 0; segment < segmentCount; segment += 1) {
      const previousPoint = points.at(-1);
      const stepCount = randomInteger(2, 7);
      const nextPoint = {
        x: previousPoint.x + direction.x * stepCount,
        y: previousPoint.y + direction.y * stepCount,
      };

      points.push(nextPoint);
      direction = chooseNewDirection(direction);
    }

    return points;
  };

  const markerAttributes = (point) => {
    const size = config.markerSize;
    const x = point.x;
    const y = point.y;
    const markerShape =
      config.markerShape === "random"
        ? ["circle", "square", "diamond", "hexagon"][
            randomInteger(0, 3)
          ]
        : config.markerShape;

    if (markerShape === "circle") {
      return {
        name: "circle",
        attributes: { cx: x, cy: y, r: size },
      };
    }

    if (markerShape === "square") {
      return {
        name: "rect",
        attributes: {
          x: x - size,
          y: y - size,
          width: size * 2,
          height: size * 2,
          rx: Math.min(1, size * 0.2),
        },
      };
    }

    if (markerShape === "diamond") {
      return {
        name: "polygon",
        attributes: {
          points: `${x},${y - size * 1.25} ${x + size * 1.25},${y} ${x},${
            y + size * 1.25
          } ${x - size * 1.25},${y}`,
        },
      };
    }

    const points = Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 3) * index;
      return `${x + Math.cos(angle) * size},${
        y + Math.sin(angle) * size
      }`;
    }).join(" ");

    return { name: "polygon", attributes: { points } };
  };

  const gradientPalettes = {
    rainbow: [
      "#ff315b",
      "#ffbd2e",
      "#55d66b",
      "#28cbe0",
      "#4277ff",
      "#bd4cff",
      "#ff315b",
    ],
    silver: [
      "#555d66",
      "#d8dee3",
      "#ffffff",
      "#87919a",
      "#f5f7f8",
      "#aab2b9",
      "#555d66",
    ],
    gold: [
      "#704200",
      "#d39b1f",
      "#fff0a8",
      "#986000",
      "#f4cf58",
      "#fff8cf",
      "#704200",
    ],
  };

  const createRoutePaint = (points, routeId) => {
    if (config.routeColorMode === "fixed") {
      return { paint: config.routeColor };
    }

    if (config.routeColorMode === "random") {
      return {
        paint: `hsl(${Math.round(randomBetween(0, 360))} 82% 52%)`,
      };
    }

    const palette =
      gradientPalettes[config.routeColorMode] ?? gradientPalettes.rainbow;
    const gradientId = `route-gradient-${routeId}`;
    const gradient = makeSvgElement("linearGradient", {
      id: gradientId,
      gradientUnits: "userSpaceOnUse",
      spreadMethod: "repeat",
    });
    const firstPoint = points[0];
    const lastPoint = points.at(-1);
    const deltaX = lastPoint.x - firstPoint.x;
    const deltaY = lastPoint.y - firstPoint.y;
    const distance = Math.hypot(deltaX, deltaY) || 1;
    const unitX = deltaX / distance;
    const unitY = deltaY / distance;
    const period = config.routeColorMode === "rainbow" ? 180 : 130;
    const x1 = firstPoint.x;
    const y1 = firstPoint.y;
    const x2 = x1 + unitX * period;
    const y2 = y1 + unitY * period;
    const shiftX = unitX * period;
    const shiftY = unitY * period;
    const duration = config.routeColorMode === "rainbow" ? "4.5s" : "3.2s";

    gradient.setAttribute("x1", x1);
    gradient.setAttribute("y1", y1);
    gradient.setAttribute("x2", x2);
    gradient.setAttribute("y2", y2);

    palette.forEach((color, index) => {
      gradient.append(
        makeSvgElement("stop", {
          offset: `${(index / (palette.length - 1)) * 100}%`,
          "stop-color": color,
        }),
      );
    });

    [
      ["x1", x1 - shiftX, x1],
      ["y1", y1 - shiftY, y1],
      ["x2", x2 - shiftX, x2],
      ["y2", y2 - shiftY, y2],
    ].forEach(([attributeName, from, to]) => {
      gradient.append(
        makeSvgElement("animate", {
          attributeName,
          from,
          to,
          dur: duration,
          repeatCount: "indefinite",
        }),
      );
    });

    return {
      definition: gradient,
      paint: `url(#${gradientId})`,
    };
  };

  const scheduleRoute = (initialDelay) => {
    window.clearTimeout(spawnTimer);

    if (reducedMotion.matches) return;

    spawnTimer = window.setTimeout(() => {
      if (!document.hidden && activeRoutes < config.maxRoutes) {
        createRoute();
      }
      scheduleRoute();
    }, initialDelay ?? randomBetween(config.spawnInterval * 0.92, config.spawnInterval * 1.08));
  };

  const createRoute = () => {
    const points = createRoutePoints();
    const pathDefinition = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(3)} ${point.y.toFixed(
            3,
          )}`,
      )
      .join(" ");
    const routeId = routeNumber++;
    const routePaint = createRoutePaint(points, routeId);
    const maskId = `route-mask-${routeId}`;
    const mask = makeSvgElement("mask", {
      id: maskId,
      maskUnits: "userSpaceOnUse",
      x: "-100",
      y: "-100",
      width: window.innerWidth + 200,
      height: window.innerHeight + 200,
    });
    const revealPath = makeSvgElement("path", {
      d: pathDefinition,
      fill: "none",
      stroke: "white",
      "stroke-width": config.routeWidth + 3,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    const erasePath = makeSvgElement("path", {
      d: pathDefinition,
      fill: "none",
      stroke: "black",
      "stroke-width": config.routeWidth + 4,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    const route = makeSvgElement("g", {
      style: `--route-paint: ${routePaint.paint}`,
    });
    const line = makeSvgElement("path", {
      class: "route-line",
      d: pathDefinition,
      mask: `url(#${maskId})`,
    });

    mask.append(revealPath, erasePath);
    route.append(line);
    defs.append(mask);
    if (routePaint.definition) defs.append(routePaint.definition);
    routeLayer.append(route);
    activeRoutes += 1;

    const totalLength = line.getTotalLength();
    const speed = randomBetween(
      config.routeSpeed * 0.78,
      config.routeSpeed * 1.22,
    );
    const travelDuration = (totalLength / speed) * 1000;
    const trailDelay = randomBetween(
      config.trailDuration * 0.68,
      config.trailDuration * 1.32,
    );
    const segmentLengths = [];
    const turnAnimations = [];
    let distanceTravelled = 0;

    points.slice(1).forEach((point, index) => {
      const previousPoint = points[index];
      distanceTravelled += Math.hypot(
        point.x - previousPoint.x,
        point.y - previousPoint.y,
      );
      segmentLengths.push(distanceTravelled);
    });

    [revealPath, erasePath].forEach((path) => {
      path.style.strokeDasharray = `${totalLength} ${totalLength}`;
      path.style.strokeDashoffset = totalLength;
    });

    const revealAnimation = revealPath.animate(
      [{ strokeDashoffset: totalLength }, { strokeDashoffset: 0 }],
      {
        duration: travelDuration,
        easing: "linear",
        fill: "forwards",
      },
    );
    const eraseAnimation = erasePath.animate(
      [{ strokeDashoffset: totalLength }, { strokeDashoffset: 0 }],
      {
        delay: trailDelay,
        duration: travelDuration,
        easing: "linear",
        fill: "forwards",
      },
    );

    if (config.markerShape !== "none") {
      points.slice(1, -1).forEach((point, index) => {
        const marker = markerAttributes(point);
        const shape = makeSvgElement(marker.name, {
          class: "route-turn",
          ...marker.attributes,
        });
        const arrivalDelay =
          (segmentLengths[index] / totalLength) * travelDuration;

        route.append(shape);
        turnAnimations.push(
          shape
            .animate(
              [
                { opacity: 0, transform: "scale(0.25)" },
                { opacity: 1, transform: "scale(1)", offset: 0.14 },
                { opacity: 1, transform: "scale(1)", offset: 0.68 },
                { opacity: 0, transform: "scale(0.65)" },
              ],
              {
                delay: arrivalDelay,
                duration: randomBetween(800, 1350),
                easing: "ease-out",
                fill: "forwards",
              },
            )
            .finished,
        );
      });
    }

    Promise.allSettled([
      revealAnimation.finished,
      eraseAnimation.finished,
      ...turnAnimations,
    ]).then(() => {
      route.remove();
      mask.remove();
      routePaint.definition?.remove();
      activeRoutes = Math.max(0, activeRoutes - 1);
    });
  };

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      clearRoutes();
    } else {
      scheduleRoute(100);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !reducedMotion.matches) {
      scheduleRoute(100);
    }
  });

  window.addEventListener("resize", () => {
    setViewport();
    clearRoutes();
    scheduleRoute(150);
  });

  setViewport();
  scheduleRoute(150);
}

const buildDocument = (config) => {
  const fineGrid = makeGridDataUri({
    width: config.baseSpacing,
    color: config.fineColor,
    lineWidth: config.fineWidth,
    opacity: config.fineOpacity,
    style: config.gridStyle,
  });
  const coarseGrid = makeGridDataUri({
    width: config.baseSpacing * config.coarseInterval,
    color: config.coarseColor,
    lineWidth: config.coarseWidth,
    opacity: config.coarseOpacity,
    style: config.gridStyle,
  });
  const dashArray = routeDashArray(config.routeStyle);
  const lineCap = config.routeStyle === "dotted" ? "round" : "round";
  const serializedConfig = JSON.stringify(config, null, 2);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Isometric Background</title>
    <style>
      :root {
        color-scheme: light;
        background: ${config.backgroundColor};
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        min-height: 100%;
        margin: 0;
      }

      body {
        min-height: 100vh;
        overflow: hidden;
        background-color: ${config.backgroundColor};
        background-image:
          url("${coarseGrid}"),
          url("${fineGrid}");
        background-position: 0 0, 0 0;
        background-repeat: repeat;
      }

      .route-field {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        pointer-events: none;
      }

      .route-line {
        fill: none;
        stroke: var(--route-paint);
        stroke-width: ${formatNumber(config.routeWidth)};
        stroke-linecap: ${lineCap};
        stroke-linejoin: round;
        stroke-dasharray: ${dashArray};
        opacity: 0.92;
        vector-effect: non-scaling-stroke;
      }

      .route-turn {
        fill: ${config.backgroundColor};
        stroke: var(--route-paint);
        stroke-width: ${formatNumber(config.routeWidth)};
        opacity: 0;
        transform-box: fill-box;
        transform-origin: center;
        vector-effect: non-scaling-stroke;
      }
    </style>
  </head>
  <body>
    <svg class="route-field" data-route-field aria-hidden="true">
      <defs data-route-defs></defs>
      <g data-routes></g>
    </svg>

    <script>
      const backgroundConfig = ${serializedConfig};

      (${routeRuntime.toString()})(backgroundConfig);
    <\/script>
  </body>
</html>
`;
};

let generatedDocument = "";
let previewTimer;

const updateConditionalControls = (config) => {
  const fixed = config.routeColorMode === "fixed";
  const input = fixedColorControl.querySelector("input");
  input.disabled = !fixed;
  fixedColorControl.dataset.disabled = String(!fixed);
};

const syncColorOutputs = () => {
  controls.querySelectorAll('input[type="color"]').forEach((input) => {
    const output = controls.querySelector(
      `[data-color-output="${input.name}"]`,
    );
    output.value = input.value;
    output.textContent = input.value;
  });
};

const syncNumericPairs = () => {
  numericKeys.forEach((key) => {
    const numberInput = controls.querySelector(`[data-number="${key}"]`);
    const rangeInput = controls.querySelector(`[data-range="${key}"]`);
    const value = clampInput(numberInput);
    rangeInput.value = String(value);
  });
};

const render = ({ immediate = false } = {}) => {
  window.clearTimeout(previewTimer);
  const config = getConfig();
  syncColorOutputs();
  updateConditionalControls(config);
  generatedDocument = buildDocument(config);
  codeOutput.value = generatedDocument;

  const updatePreview = () => {
    preview.srcdoc = generatedDocument;
  };

  if (immediate) {
    updatePreview();
  } else {
    previewTimer = window.setTimeout(updatePreview, 180);
  }
};

controls.addEventListener("input", (event) => {
  const rangeKey = event.target.dataset.range;
  const numberKey = event.target.dataset.number;

  if (rangeKey) {
    controls.querySelector(`[data-number="${rangeKey}"]`).value =
      event.target.value;
  }

  if (numberKey) {
    const value = Number(event.target.value);
    const minimum = Number(event.target.min);
    const maximum = Number(event.target.max);

    if (
      event.target.value === "" ||
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    ) {
      return;
    }

    controls.querySelector(`[data-range="${numberKey}"]`).value =
      event.target.value;
  }

  render();
});

controls.addEventListener("change", () => {
  syncNumericPairs();
  render({ immediate: true });
});

resetButton.addEventListener("click", () => {
  controls.reset();
  syncNumericPairs();
  copyStatus.dataset.state = "";
  copyStatus.textContent = "Defaults restored.";
  render({ immediate: true });
});

const fallbackCopy = () => {
  codeOutput.focus();
  codeOutput.select();
  codeOutput.setSelectionRange(0, codeOutput.value.length);
  const copied = document.execCommand("copy");
  window.getSelection()?.removeAllRanges();
  return copied;
};

const copyGeneratedDocument = async () => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(generatedDocument);
    } else if (!fallbackCopy()) {
      throw new Error("Copy command was unavailable.");
    }

    copyStatus.dataset.state = "success";
    copyStatus.textContent = "Copied the complete HTML document.";
  } catch {
    const copied = fallbackCopy();
    copyStatus.dataset.state = copied ? "success" : "error";
    copyStatus.textContent = copied
      ? "Copied the complete HTML document."
      : "Copy failed. Select the generated HTML and copy it manually.";
  }
};

copyButtons.forEach((button) => {
  button.addEventListener("click", copyGeneratedDocument);
});

syncNumericPairs();
render({ immediate: true });
