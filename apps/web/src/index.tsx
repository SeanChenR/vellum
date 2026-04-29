import { VELLUM_VERSION } from "@vellum/shared";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

root.textContent = `Vellum web — scaffolding stub (v${VELLUM_VERSION}). See docs/PRD.md.`;
