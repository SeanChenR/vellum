import { VELLUM_VERSION } from "@vellum/shared";

const PORT = Number(Bun.env.PORT ?? 3000);

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", version: VELLUM_VERSION });
    }

    return new Response("Vellum API — scaffolding stub. See docs/PRD.md.", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
});

console.log(`Vellum API listening on http://localhost:${server.port}`);
