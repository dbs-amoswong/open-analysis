import http from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIST_DIR } from "./lib/load.mjs";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function resolveFile(urlPath, root) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  let file = path.join(root, relative);

  // Prevent path traversal.
  if (!file.startsWith(path.resolve(root))) return null;

  try {
    const info = await stat(file);
    if (info.isDirectory()) {
      file = path.join(file, "index.html");
      await stat(file);
    }
    return file;
  } catch {
    return null;
  }
}

export function startServer({ port = 4173, root = DIST_DIR } = {}) {
  const resolvedRoot = path.resolve(root);

  const server = http.createServer(async (req, res) => {
    const file = await resolveFile(req.url || "/", resolvedRoot);

    if (!file) {
      const notFound = path.join(resolvedRoot, "404.html");
      try {
        const body = await stat(notFound);
        res.writeHead(404, { "content-type": TYPES[".html"], "content-length": body.size });
        createReadStream(notFound).pipe(res);
      } catch {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
      }
      return;
    }

    const info = await stat(file);
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "content-length": info.size,
      "cache-control": "no-cache",
    });
    createReadStream(file).pipe(res);
  });

  server.listen(port, () => {
    console.log(`Serving dist/ at http://localhost:${port}`);
  });

  return server;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const portArg = process.argv.find((a) => a.startsWith("--port="));
  const port = portArg ? Number(portArg.split("=")[1]) : 4173;
  startServer({ port });
}
