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

interface ProxyWsData {
  upstream: WebSocket | null;
  buffered: Array<string | ArrayBufferLike | Uint8Array>;
  target: string;
  cookie: string;
}

const server = Bun.serve<ProxyWsData>({
  port: 3002,
  async fetch(req, srv) {
    const url = new URL(req.url);

    // /sync/* — upgrade to WebSocket and proxy to upstream API on :3000.
    // The single-binary architecture co-locates HTTP + WS on :3000; this
    // proxy hop only exists in dev so the browser sees same-origin :3002
    // (or, when fronted by Cloudflare Tunnel, the public host).
    if (url.pathname.startsWith("/sync/")) {
      const target = "ws://localhost:3000" + url.pathname + url.search;
      const cookie = req.headers.get("cookie") ?? "";
      if (
        srv.upgrade(req, {
          data: { upstream: null, buffered: [], target, cookie },
        })
      ) {
        return;
      }
      return new Response("Upgrade failed", { status: 426 });
    }

    // API + health + /dev/* (M12.1 server-side mutator) + /agent/* (M13
    // agent runtime SSE + cancel endpoints) → upstream API. The /dev/*
    // prefix is only registered on :3000 when NODE_ENV !== "production";
    // the proxy forwards transparently in dev.
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/dev/") ||
      url.pathname.startsWith("/agent/") ||
      url.pathname === "/health"
    ) {
      // SSE: stretch idle timeout to Bun's 255 s ceiling so long agent
      // runs (model thinking + tool calls) aren't killed at the default
      // 10 s. Matches the upstream API's per-request override on the
      // same path.
      if (/^\/api\/agent\/canvas\/[^/]+\/run$/.test(url.pathname)) {
        srv.timeout(req, 255);
      }
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

  websocket: {
    open(ws) {
      // The fetch handler stashed the upstream target + browser cookie on
      // ws.data; open an upstream socket and pipe both directions. We pass
      // the cookie via the Bun WebSocket `headers` option so better-auth
      // upstream sees the same session as the browser.
      const { target, cookie } = ws.data;
      if (!target) {
        ws.close(1011, "missing upstream target");
        return;
      }
      const upstream = new WebSocket(target, {
        headers: cookie ? { cookie } : {},
      } as unknown as undefined);
      ws.data.upstream = upstream;
      upstream.binaryType = "arraybuffer";
      upstream.addEventListener("open", () => {
        for (const m of ws.data.buffered) upstream.send(m as never);
        ws.data.buffered = [];
      });
      upstream.addEventListener("message", (e) => {
        ws.send(e.data as string | ArrayBuffer | Uint8Array);
      });
      upstream.addEventListener("close", (e) => {
        try {
          ws.close(e.code, e.reason);
        } catch {}
      });
      upstream.addEventListener("error", () => {
        try {
          ws.close(1011, "upstream error");
        } catch {}
      });
    },
    message(ws, message) {
      const up = ws.data.upstream;
      if (up && up.readyState === 1) up.send(message as never);
      else ws.data.buffered.push(message);
    },
    close(ws) {
      try {
        ws.data.upstream?.close();
      } catch {}
    },
  },
});

console.log(`[proxy] listening on :${server.port} (dist: ${DIST})`);
