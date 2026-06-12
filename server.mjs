import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT ?? "4173", 10);
const DIST_DIR = path.join(__dirname, "dist");
const PROXY_PREFIX = "/sea-of-simulation";
const SEA_OF_SIMULATION_ORIGIN = process.env.SEA_OF_SIMULATION_ORIGIN ?? "";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
}

function normalizeOriginUrl(value) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

function buildTargetUrl(requestUrl) {
  const normalizedOrigin = normalizeOriginUrl(SEA_OF_SIMULATION_ORIGIN);

  if (!normalizedOrigin) {
    return null;
  }

  const incomingUrl = new URL(requestUrl, "http://127.0.0.1");
  const upstreamBase = new URL(normalizedOrigin);
  const upstreamPath = incomingUrl.pathname.replace(PROXY_PREFIX, "") || "/";

  upstreamBase.pathname = `${upstreamBase.pathname.replace(/\/$/, "")}${upstreamPath}`;
  upstreamBase.search = incomingUrl.search;
  return upstreamBase;
}

async function proxyRequest(req, res) {
  const targetUrl = buildTargetUrl(req.url ?? PROXY_PREFIX);

  if (!targetUrl) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("SEA_OF_SIMULATION_ORIGIN is not configured");
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }
    headers.set(key, value);
  }

  headers.set("host", targetUrl.host);
  headers.set("x-forwarded-host", req.headers.host ?? "");
  headers.set("x-forwarded-proto", "https");
  headers.set("x-forwarded-prefix", PROXY_PREFIX);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: req.method === "GET" || req.method === "HEAD" ? undefined : "half",
    });

    const responseHeaders = {};
    upstreamResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "transfer-encoding") {
        return;
      }
      responseHeaders[key] = value;
    });

    if (req.method === "HEAD") {
      res.writeHead(upstreamResponse.status, responseHeaders);
      res.end();
      return;
    }

    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    console.log(
      `[sea-proxy] ${req.method} ${req.url} -> ${targetUrl} status=${upstreamResponse.status} bytes=${responseBuffer.length}`,
    );
    responseHeaders["content-length"] = String(responseBuffer.length);
    res.writeHead(upstreamResponse.status, responseHeaders);
    res.end(responseBuffer);
  } catch (error) {
    console.error(`[sea-proxy] ${req.method} ${req.url} failed:`, error);
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end(`Failed to proxy Sea of Simulation request: ${error.message}`);
      return;
    }
    if (!res.writableEnded) {
      res.destroy(error);
    }
  }
}

function safeResolveFromDist(requestPath) {
  const normalizedPath = decodeURIComponent(requestPath.split("?")[0]);
  const relativePath = normalizedPath === "/" ? "/index.html" : normalizedPath;
  const resolvedPath = path.normalize(path.join(DIST_DIR, relativePath));

  if (!resolvedPath.startsWith(DIST_DIR)) {
    return null;
  }

  return resolvedPath;
}

async function serveStatic(req, res) {
  const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");
  const requestedPath = safeResolveFromDist(requestUrl.pathname);
  const fallbackPath = path.join(DIST_DIR, "index.html");

  if (!requestedPath) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Invalid path");
    return;
  }

  let filePath = requestedPath;
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    const isAssetRequest = path.extname(requestUrl.pathname) !== "";
    if (!existsSync(filePath) && !isAssetRequest) {
      filePath = fallbackPath;
    }
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }

    res.writeHead(200, {
      "content-length": fileStat.size,
      "content-type": getContentType(filePath),
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

createServer(async (req, res) => {
  const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;

  if (pathname === PROXY_PREFIX || pathname.startsWith(`${PROXY_PREFIX}/`)) {
    await proxyRequest(req, res);
    return;
  }

  await serveStatic(req, res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
