import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { VELLUM_VERSION } from "@vellum/shared";

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen">
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

function HomePage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center">
        <h1 className="font-serif text-4xl text-ink-navy">
          {t("app.name", "Vellum")}
        </h1>
        <p className="mt-2 text-warm-sepia">
          {t("app.tagline", "Scaffolding stub")} · v{VELLUM_VERSION}
        </p>
      </div>
    </main>
  );
}

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
