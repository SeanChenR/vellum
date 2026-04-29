import { VELLUM_VERSION } from "@vellum/shared";
import { logger } from "./lib/logger";

const PORT = Number(Bun.env.PORT ?? 3000);

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    const start = performance.now();

    const respond = (response: Response) => {
      const duration = Math.round(performance.now() - start);
      logger.debug(
        { method: req.method, path: url.pathname, status: response.status, duration },
        "request",
      );
      return response;
    };

    if (url.pathname === "/health") {
      return respond(Response.json({ status: "ok", version: VELLUM_VERSION }));
    }

    return respond(
      new Response("Vellum API — scaffolding stub. See docs/PRD.md.", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );
  },
});

logger.info({ port: server.port, version: VELLUM_VERSION }, "vellum api listening");
