/**
 * Dev proxy on :3002.
 *
 *   /api/*, /health  → API on :3000
 *   everything else  → static files from apps/web/dist (built bundle)
 *                      with SPA fallback to index.html, and root-asset
 *                      fallback for hashed bundles loaded from sub-paths.
 *
 * Used by `bun run dev:up` so the browser sees same-origin /api routes
 * and BETTER_AUTH_URL can stay pointed at :3002 without per-port cookie
 * trouble. Production uses the single Bun.serve binary on :3000.
 */
import { file } from "bun";
import { extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, "../apps/web/dist");

const MIME: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const server = Bun.serve({
  port: 3002,
  async fetch(req) {
    const url = new URL(req.url);

    // API + health → upstream API
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
      const fwd = "http://localhost:3000" + url.pathname + url.search;
      const init: RequestInit = {
        method: req.method,
        headers: req.headers,
        redirect: "manual",
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        // @ts-ignore - bun supports half-duplex streaming bodies
        init.body = req.body;
        // @ts-ignore
        init.duplex = "half";
      }
      return fetch(fwd, init);
    }

    // Static files
    let pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    let f = file(DIST + pathname);
    let exists = await f.exists();

    // Hashed-asset fallback: built index.html emits ./index-xxx.js, which
    // browsers resolve against the current route. Serve the asset from the
    // dist root regardless of where the request appeared.
    if (!exists && extname(pathname) !== "") {
      const baseName = pathname.split("/").pop()!;
      f = file(DIST + "/" + baseName);
      exists = await f.exists();
      if (exists) pathname = "/" + baseName;
    }

    // SPA fallback: any unknown path with no extension → index.html
    if (!exists && extname(pathname) === "") {
      pathname = "/index.html";
      f = file(DIST + pathname);
      exists = await f.exists();
    }

    if (!exists) return new Response("Not Found", { status: 404 });
    const mime = MIME[extname(pathname)] ?? "application/octet-stream";
    return new Response(f, { headers: { "content-type": mime } });
  },
});

console.log(`[proxy] listening on :${server.port} (dist: ${DIST})`);
