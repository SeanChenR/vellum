import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

afterEach(() => cleanup());

describe("Badge", () => {
  test.each([
    ["cyan", "bg-accent-cyan/10", "text-accent-cyan"],
    ["purple", "bg-accent-purple/10", "text-accent-purple"],
    ["orange", "bg-accent-orange/10", "text-accent-orange"],
  ] as const)("tone=%s applies %s + %s", (tone, bg, color) => {
    render(
      <Badge tone={tone} data-testid="b">
        hi
      </Badge>,
    );
    const el = screen.getByTestId("b");
    expect(el.className).toContain(bg);
    expect(el.className).toContain(color);
  });

  test("default tone is muted", () => {
    render(<Badge data-testid="b">hi</Badge>);
    const el = screen.getByTestId("b");
    expect(el.getAttribute("data-tone")).toBe("muted");
    expect(el.className).toContain("bg-surface-elevated");
  });

  test("dot prop renders the inner indicator", () => {
    render(
      <Badge tone="cyan" dot data-testid="b">
        on
      </Badge>,
    );
    expect(screen.getByTestId("badge-dot")).toBeDefined();
  });

  test("no dot by default", () => {
    render(<Badge data-testid="b">hi</Badge>);
    expect(screen.queryByTestId("badge-dot")).toBeNull();
  });
});
