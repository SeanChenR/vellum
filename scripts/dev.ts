/**
 * Vellum local dev orchestrator. One command brings up the whole stack:
 *
 *   1. Postgres (brew services postgresql@14)
 *   2. Mailpit  (brew services mailpit)
 *   3. Apply Drizzle migrations
 *   4. Initial web build (tailwind + bun build)
 *   5. API server on :3000  (bun --hot apps/api/src/index.ts)
 *   6. Web build watch      (bun build --watch → apps/web/dist)
 *   7. Dev proxy on :3002   (scripts/dev-proxy.ts)
 *
 * Visit http://localhost:3002 to use the app, http://localhost:8025 for the
 * Mailpit UI. Ctrl+C tears every child down.
 *
 * Single source of truth lives here, not in scattered shell instructions.
 */

import { spawn, spawnSync } from "bun";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const APP_API = resolve(ROOT, "apps/api");
const APP_WEB = resolve(ROOT, "apps/web");

const children: Array<{ label: string; proc: ReturnType<typeof spawn> }> = [];

/**
 * Graceful shutdown — signal children with SIGTERM, then wait up to
 * 5 s per child for it to exit so async cleanup (e.g. the api process'
 * `flushThenShutdown`, which flushes dirty snapshot mutations to DB)
 * can complete. Without the wait, debounced mutations are lost on
 * Ctrl-C — see M13 task §16.1 / docs/adr/0019.
 */
const CHILD_SHUTDOWN_TIMEOUT_MS = 5_000;

async function shutdown(code = 0): Promise<never> {
  console.log("\n[dev] stopping children...");
  for (const { proc } of children) {
    try {
      proc.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
  await Promise.all(
    children.map(({ label, proc }) =>
      Promise.race([
        proc.exited.then(() => log(label, "exited")),
        new Promise<void>((resolve) =>
          globalThis.setTimeout(() => {
            log(label, "shutdown timeout — forcing");
            try {
              proc.kill("SIGKILL");
            } catch {
              // already gone
            }
            resolve();
          }, CHILD_SHUTDOWN_TIMEOUT_MS),
        ),
      ]),
    ),
  );
  process.exit(code);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

function log(label: string, msg: string): void {
  console.log(`[${label}] ${msg}`);
}

function ensureBrewService(label: string, name: string): void {
  const list = spawnSync(["brew", "services", "list"], { stdout: "pipe" });
  const text = new TextDecoder().decode(list.stdout);
  const line = text.split("\n").find((l) => l.startsWith(name));
  if (line && /\sstarted\s/.test(line)) {
    log(label, `already running`);
    return;
  }
  log(label, `starting via brew services...`);
  const start = spawnSync(["brew", "services", "start", name], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (start.exitCode !== 0) {
    console.error(`[${label}] brew services start failed`);
    shutdown(1);
  }
}

async function waitForPort(label: string, port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-await-in-loop -- intentional: poll-with-backoff
  while (Date.now() < deadline) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const sock = await Bun.connect({
        hostname: "127.0.0.1",
        port,
        socket: { open: () => {}, data: () => {}, close: () => {}, error: () => {} },
      });
      sock.end();
      log(label, `ready on :${port}`);
      return;
    } catch {
      // eslint-disable-next-line no-await-in-loop
      await Bun.sleep(400);
    }
  }
  console.error(`[${label}] not ready on :${port} after ${timeoutMs}ms`);
  shutdown(1);
}

function clearStaleListeners(label: string, port: number): void {
  // Kill any leftover process bound to a dev port so dev:up is idempotent
  // when a previous run was killed without cleanup. Brew services are left
  // alone — only the per-run children (api, proxy) get reaped.
  const lsof = spawnSync(["lsof", "-ti", `:${port}`], { stdout: "pipe" });
  const pids = new TextDecoder()
    .decode(lsof.stdout)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (pids.length === 0) return;
  log(label, `clearing stale listener(s) on :${port} (pid ${pids.join(", ")})`);
  spawnSync(["kill", "-9", ...pids], { stdout: "ignore", stderr: "ignore" });
}

function ensureDevPostgresRoleAndDb(): void {
  // Idempotent: brew postgres uses the system user; we need a `postgres`
  // role + `vellum_dev` db so DATABASE_URL in apps/api/.env works as-is.
  spawnSync(
    ["psql", "postgres", "-c", "CREATE ROLE postgres LOGIN PASSWORD 'postgres' SUPERUSER"],
    {
      stdout: "ignore",
      stderr: "ignore",
    },
  );
  spawnSync(["psql", "postgres", "-c", "CREATE DATABASE vellum_dev OWNER postgres"], {
    stdout: "ignore",
    stderr: "ignore",
  });
}

function streamPrefixed(label: string, color: string, proc: ReturnType<typeof spawn>): void {
  const tag = `\x1b[${color}m[${label}]\x1b[0m `;
  const pump = async (stream: ReadableStream<Uint8Array> | null, out: NodeJS.WriteStream) => {
    if (!stream) return;
    const decoder = new TextDecoder();
    let buf = "";
    for await (const chunk of stream) {
      buf += decoder.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) out.write(`${tag}${line}\n`);
    }
    if (buf) out.write(`${tag}${buf}\n`);
  };
  void pump(proc.stdout as ReadableStream<Uint8Array>, process.stdout);
  void pump(proc.stderr as ReadableStream<Uint8Array>, process.stderr);
}

function startChild(
  label: string,
  color: string,
  cmd: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): ReturnType<typeof spawn> {
  const proc = spawn(cmd, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, FORCE_COLOR: "1", ...extraEnv },
  });
  children.push({ label, proc });
  streamPrefixed(label, color, proc);
  return proc;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

console.log("=== Vellum dev stack ===");

ensureBrewService("postgres", "postgresql@14");
ensureBrewService("mailpit", "mailpit");

await waitForPort("postgres", 5432);
await waitForPort("mailpit", 1025);

clearStaleListeners("preflight", 3000);
clearStaleListeners("preflight", 3002);

ensureDevPostgresRoleAndDb();

log("drizzle", "applying migrations...");
{
  const r = spawnSync(["bunx", "drizzle-kit", "migrate"], {
    cwd: APP_API,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (r.exitCode !== 0) shutdown(1);
}

log("web", "initial build (tailwind + bun build)...");
{
  const r = spawnSync(["bun", "run", "build"], {
    cwd: APP_WEB,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (r.exitCode !== 0) shutdown(1);
}

// 31 (cyan) tailwind, 32 (green) api, 35 (magenta) web, 36 (cyan) proxy
startChild("tailwind", "31", ["bun", "run", "tailwind:watch"], APP_WEB);
startChild("api", "32", ["bun", "--hot", "src/index.ts"], APP_API, {
  DISABLE_AUTH_RATE_LIMIT: "1",
});
startChild("web", "35", ["bun", "build", "src/index.html", "--outdir=dist", "--watch"], APP_WEB);
startChild("proxy", "36", ["bun", "--hot", "scripts/dev-proxy.ts"], ROOT);

await waitForPort("api", 3000);
await waitForPort("proxy", 3002);

console.log("");
console.log("✓ Vellum dev stack ready");
console.log("  app      → http://localhost:3002");
console.log("  mailpit  → http://localhost:8025");
console.log("  api      → http://localhost:3000 (proxied via :3002)");
console.log("  postgres → localhost:5432 (vellum_dev)");
console.log("");
console.log("Press Ctrl+C to stop everything.");

// Block forever; SIGINT handler tears down.
await new Promise<never>(() => {});
