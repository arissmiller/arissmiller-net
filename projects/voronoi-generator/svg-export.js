function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = Math.max(dx * dx + dy * dy, 0.0001);
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * amount), point.y - (start.y + dy * amount));
}

function manhattanBisectorDistance(point, siteA, siteB) {
  const dx = siteB.x - siteA.x;
  const dy = siteB.y - siteA.y;
  const localX = (point.x - (siteA.x + siteB.x) * 0.5) * (dx < 0 ? -1 : 1);
  const localY = (point.y - (siteA.y + siteB.y) * 0.5) * (dy < 0 ? -1 : 1);
  const dominant = Math.abs(dx) >= Math.abs(dy) ? localX : localY;
  const other = Math.abs(dx) >= Math.abs(dy) ? localY : localX;
  const halfMinor = Math.min(Math.abs(dx), Math.abs(dy)) * 0.5;
  return Math.min(
    distanceToSegment(
      { x: dominant, y: other },
      { x: halfMinor, y: -halfMinor },
      { x: -halfMinor, y: halfMinor },
    ),
    Math.hypot(dominant + halfMinor, Math.max(halfMinor - other, 0)),
    Math.hypot(dominant - halfMinor, Math.max(other + halfMinor, 0)),
  );
}

function smoothMinimum(a, b, radius) {
  if (radius <= 0.001) return Math.min(a, b);
  const blend = Math.max(radius - Math.abs(a - b), 0) / radius;
  return Math.min(a, b) - blend * blend * radius * 0.25;
}

function sampleField(config, sites, columns, rows, width, height) {
  const samples = [];
  const pixelSites = sites.map((site) => ({ x: site.x * width, y: site.y * height }));
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const point = { x: column / columns * width, y: row / rows * height };
      let owner = 0;
      let nearest = Infinity;
      pixelSites.forEach((site, index) => {
        const dx = Math.abs(point.x - site.x);
        const dy = Math.abs(point.y - site.y);
        const distance = config.metric === "manhattan" ? dx + dy : Math.hypot(dx, dy);
        if (distance < nearest) { nearest = distance; owner = index; }
      });

      let boundary = Math.min(point.x, width - point.x, point.y, height - point.y);
      pixelSites.forEach((other, index) => {
        if (index === owner) return;
        let candidate;
        if (config.metric === "manhattan") {
          candidate = manhattanBisectorDistance(point, pixelSites[owner], other);
        } else {
          const own = pixelSites[owner];
          candidate = (
            (point.x - other.x) ** 2 + (point.y - other.y) ** 2
            - (point.x - own.x) ** 2 - (point.y - own.y) ** 2
          ) / Math.max(2 * Math.hypot(other.x - own.x, other.y - own.y), 0.0001);
        }
        boundary = smoothMinimum(boundary, Math.max(0, candidate), config.rounding);
      });
      samples.push({ owner, boundary });
    }
  }
  return samples;
}

function contourPath(samples, owner, columns, rows, width, height, threshold) {
  const segments = [];
  const sample = (x, y) => {
    const value = samples[y * (columns + 1) + x];
    return value.owner === owner ? value.boundary - threshold : -value.boundary - threshold;
  };
  const point = (edge, x, y, values) => {
    const horizontal = edge === "top" || edge === "bottom";
    const startValue = edge === "top" ? values.tl : edge === "right" ? values.tr : edge === "bottom" ? values.bl : values.tl;
    const endValue = edge === "top" ? values.tr : edge === "right" ? values.br : edge === "bottom" ? values.br : values.bl;
    const amount = Math.max(0, Math.min(1, startValue / (startValue - endValue || 1)));
    const gridX = horizontal ? x + amount : x + (edge === "right" ? 1 : 0);
    const gridY = horizontal ? y + (edge === "bottom" ? 1 : 0) : y + amount;
    const key = horizontal ? `h:${x}:${y + (edge === "bottom" ? 1 : 0)}` : `v:${x + (edge === "right" ? 1 : 0)}:${y}`;
    return { key, x: gridX / columns * width, y: gridY / rows * height };
  };
  const table = {
    1: [["left", "top"]], 2: [["top", "right"]], 3: [["left", "right"]],
    4: [["right", "bottom"]], 5: [["left", "top"], ["right", "bottom"]],
    6: [["top", "bottom"]], 7: [["left", "bottom"]], 8: [["bottom", "left"]],
    9: [["top", "bottom"]], 10: [["top", "right"], ["bottom", "left"]],
    11: [["right", "bottom"]], 12: [["left", "right"]],
    13: [["top", "right"]], 14: [["left", "top"]],
  };

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const values = { tl: sample(x, y), tr: sample(x + 1, y), br: sample(x + 1, y + 1), bl: sample(x, y + 1) };
      const code = (values.tl > 0 ? 1 : 0) | (values.tr > 0 ? 2 : 0) | (values.br > 0 ? 4 : 0) | (values.bl > 0 ? 8 : 0);
      (table[code] || []).forEach(([first, second]) => segments.push([
        point(first, x, y, values), point(second, x, y, values),
      ]));
    }
  }

  const connections = new Map();
  segments.forEach((segment, index) => segment.forEach((endpoint) => {
    if (!connections.has(endpoint.key)) connections.set(endpoint.key, []);
    connections.get(endpoint.key).push(index);
  }));
  const used = new Set();
  const paths = [];
  segments.forEach((segment, initialIndex) => {
    if (used.has(initialIndex)) return;
    used.add(initialIndex);
    const chain = [segment[0], segment[1]];
    let current = segment[1];
    while (current.key !== chain[0].key) {
      const nextIndex = (connections.get(current.key) || []).find((index) => !used.has(index));
      if (nextIndex === undefined) break;
      used.add(nextIndex);
      const next = segments[nextIndex];
      current = next[0].key === current.key ? next[1] : next[0];
      chain.push(current);
    }
    if (chain.length > 2) paths.push(chain);
  });
  return paths.map((path) => `M${path.map((entry) => `${entry.x.toFixed(2)} ${entry.y.toFixed(2)}`).join("L")}Z`).join("");
}

export function generateVoronoiSvg(config, sites, width = 1200, height = 760) {
  const columns = 360;
  const rows = Math.round(columns * height / width);
  const samples = sampleField(config, sites, columns, rows, width, height);
  const threshold = config.gap + config.lineWidth * 0.5;
  const cellPaths = sites.map((_, index) => contourPath(samples, index, columns, rows, width, height, threshold)).filter(Boolean);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${config.background}"/>`,
    `<g fill="${config.foreground}" stroke="${config.line}" stroke-width="${config.lineWidth}" stroke-linejoin="round">`,
    ...cellPaths.map((path) => `<path d="${path}"/>`),
    `</g><g fill="${config.line}">`,
    ...sites.map((site) => `<circle cx="${(site.x * width).toFixed(2)}" cy="${(site.y * height).toFixed(2)}" r="${config.pointSize}"/>`),
    `</g></svg>`,
  ].join("");
}
