import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { App } from "./App";

afterEach(() => {
  cleanup();
});

describe("App smoke", () => {
  test("mounts without crashing and renders Vellum branding", async () => {
    render(<App />);
    // Router + i18n hydrate asynchronously — findByText waits.
    const branding = await screen.findByText(/Vellum/i);
    expect(branding).not.toBeNull();
  });
});
