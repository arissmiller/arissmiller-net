import { MAX_SITES } from "./simulation.js";

const vertexSource = `#version 300 es
in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const fragmentSource = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform int u_siteCount;
uniform vec2 u_sites[${MAX_SITES}];
uniform float u_weights[${MAX_SITES}];
uniform int u_metric;
uniform float u_gap;
uniform float u_lineWidth;
uniform float u_softness;
uniform float u_rounding;
uniform float u_pointSize;
uniform int u_boundCanvas;
uniform vec3 u_background;
uniform vec3 u_foreground;
uniform vec3 u_lineColor;
out vec4 outColor;

float metricDistance(vec2 a, vec2 b) {
  vec2 delta = abs(a - b);
  return u_metric == 1 ? delta.x + delta.y : length(delta);
}

float distanceToSegment(vec2 point, vec2 start, vec2 end) {
  vec2 segment = end - start;
  float lengthSquared = max(dot(segment, segment), 0.0001);
  float amount = clamp(dot(point - start, segment) / lengthSquared, 0.0, 1.0);
  return length(point - (start + segment * amount));
}

float smoothMinimum(float a, float b, float radius) {
  if (radius <= 0.001) return min(a, b);
  float blend = max(radius - abs(a - b), 0.0) / radius;
  return min(a, b) - blend * blend * radius * 0.25;
}

// In coordinates aligned from site A to site B, a two-dimensional L1
// bisector is one diagonal segment joined to two parallel rays. Measuring
// against those primitives avoids the angle-dependent widening produced by
// using a raw difference of distances.
float manhattanBisectorDistance(vec2 point, vec2 siteA, vec2 siteB) {
  vec2 delta = siteB - siteA;
  vec2 direction = vec2(delta.x < 0.0 ? -1.0 : 1.0, delta.y < 0.0 ? -1.0 : 1.0);
  vec2 local = (point - (siteA + siteB) * 0.5) * direction;
  float dominant;
  float other;
  float halfMinor;

  if (abs(delta.x) >= abs(delta.y)) {
    dominant = local.x;
    other = local.y;
    halfMinor = abs(delta.y) * 0.5;
  } else {
    dominant = local.y;
    other = local.x;
    halfMinor = abs(delta.x) * 0.5;
  }

  vec2 localPoint = vec2(dominant, other);
  float center = distanceToSegment(
    localPoint,
    vec2(halfMinor, -halfMinor),
    vec2(-halfMinor, halfMinor)
  );
  float upperRay = length(vec2(
    dominant + halfMinor,
    max(halfMinor - other, 0.0)
  ));
  float lowerRay = length(vec2(
    dominant - halfMinor,
    max(other + halfMinor, 0.0)
  ));
  return min(center, min(upperRay, lowerRay));
}

void main() {
  vec2 pixel = gl_FragCoord.xy;
  float nearest = 100000.0;
  float nearestRawDistance = 100000.0;
  float nearestWeight = 0.0;
  vec2 nearestSite = vec2(0.0);
  int nearestIndex = 0;

  for (int i = 0; i < ${MAX_SITES}; i++) {
    if (i >= u_siteCount) break;
    vec2 site = u_sites[i] * u_resolution;
    float rawDistance = metricDistance(pixel, site);
    float siteDistance = rawDistance * rawDistance - u_weights[i];
    if (siteDistance < nearest) {
      nearest = siteDistance;
      nearestRawDistance = rawDistance;
      nearestWeight = u_weights[i];
      nearestSite = site;
      nearestIndex = i;
    }
  }

  float boundaryDistance = u_boundCanvas == 1
    ? min(min(pixel.x, u_resolution.x - pixel.x), min(pixel.y, u_resolution.y - pixel.y))
    : 100000.0;
  for (int i = 0; i < ${MAX_SITES}; i++) {
    if (i >= u_siteCount) break;
    if (i == nearestIndex) continue;
    vec2 otherSite = u_sites[i] * u_resolution;
    float otherWeight = u_weights[i];
    float candidate;
    if (u_metric == 1 && abs(nearestWeight) + abs(otherWeight) <= 0.001) {
      candidate = manhattanBisectorDistance(pixel, nearestSite, otherSite);
    } else if (u_metric == 1) {
      float otherDistance = metricDistance(pixel, otherSite);
      float scoreDifference = otherDistance * otherDistance - otherWeight
        - (nearestRawDistance * nearestRawDistance - nearestWeight);
      vec2 nearestGradient = 2.0 * nearestRawDistance * sign(pixel - nearestSite);
      vec2 otherGradient = 2.0 * otherDistance * sign(pixel - otherSite);
      candidate = scoreDifference / max(length(otherGradient - nearestGradient), 0.0001);
    } else {
      float denominator = max(2.0 * length(otherSite - nearestSite), 0.0001);
      candidate = (
        dot(pixel - otherSite, pixel - otherSite) - otherWeight
        - dot(pixel - nearestSite, pixel - nearestSite) + nearestWeight
      ) / denominator;
    }
    candidate = max(0.0, candidate);
    boundaryDistance = smoothMinimum(boundaryDistance, candidate, u_rounding);
  }
  float feather = max(0.35, u_softness);
  float fillStart = u_gap + u_lineWidth;
  float lineMask = smoothstep(u_gap - feather, u_gap + feather, boundaryDistance)
    * (1.0 - smoothstep(fillStart - feather, fillStart + feather, boundaryDistance));
  float fillMask = smoothstep(fillStart - feather, fillStart + feather, boundaryDistance);

  vec3 color = mix(u_background, u_lineColor, lineMask);
  color = mix(color, u_foreground, fillMask);

  float pointDistance = length(pixel - nearestSite);
  float pointMask = u_pointSize <= 0.0
    ? 0.0
    : 1.0 - smoothstep(u_pointSize - feather, u_pointSize + feather, pointDistance);
  color = mix(color, u_lineColor, pointMask);
  outColor = vec4(color, 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || "Unable to compile shader");
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "Unable to link shader");
  }
  return program;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const program = createProgram(gl);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const uniforms = {
    resolution: uniform("u_resolution"),
    siteCount: uniform("u_siteCount"),
    sites: uniform("u_sites[0]"),
    weights: uniform("u_weights[0]"),
    metric: uniform("u_metric"),
    gap: uniform("u_gap"),
    lineWidth: uniform("u_lineWidth"),
    softness: uniform("u_softness"),
    rounding: uniform("u_rounding"),
    pointSize: uniform("u_pointSize"),
    boundCanvas: uniform("u_boundCanvas"),
    background: uniform("u_background"),
    foreground: uniform("u_foreground"),
    lineColor: uniform("u_lineColor"),
  };

  return {
    resize(width, height) {
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    },
    render(config, sites, colors) {
      const positions = new Float32Array(MAX_SITES * 2);
      const weights = new Float32Array(MAX_SITES);
      sites.forEach((site, index) => {
        positions[index * 2] = site.x;
        positions[index * 2 + 1] = 1 - site.y;
        weights[index] = (site.weight || 0) * canvas.height * canvas.height;
      });
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1i(uniforms.siteCount, sites.length);
      gl.uniform2fv(uniforms.sites, positions);
      gl.uniform1fv(uniforms.weights, weights);
      gl.uniform1i(uniforms.metric, config.metric === "manhattan" ? 1 : 0);
      gl.uniform1f(uniforms.gap, config.gap * config.pixelRatio);
      gl.uniform1f(uniforms.lineWidth, config.lineWidth * config.pixelRatio);
      gl.uniform1f(uniforms.softness, config.softness * config.pixelRatio);
      gl.uniform1f(uniforms.rounding, config.rounding * config.pixelRatio);
      gl.uniform1f(uniforms.pointSize, config.pointSize * config.pixelRatio);
      gl.uniform1i(uniforms.boundCanvas, config.boundCanvas === false ? 0 : 1);
      gl.uniform3fv(uniforms.background, colors.background);
      gl.uniform3fv(uniforms.foreground, colors.foreground);
      gl.uniform3fv(uniforms.lineColor, colors.line);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
