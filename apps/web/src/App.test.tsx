import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { App } from "./App";

afterEach(() => {
  cleanup();
});

describe("App smoke", () => {
  test("mounts without crashing and renders Vellum branding", async () => {
    render(<App />);
    // Router + i18n hydrate asynchronously — findAllByText waits.
    // The public Homepage renders "Vellum" multiple times (navbar brand,
    // footer, mobile notice) so we expect ≥ 1 match.
    const matches = await screen.findAllByText(/Vellum/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
