/**
 * Card.test.tsx — primitive contract.
 *
 * Spec ref: openspec/specs/public-pages/spec.md
 *   "HomePage feature cards use the elevated Card primitive"
 */

import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Card } from "./Card";

afterEach(() => cleanup());

describe("Card", () => {
  test("default variant has bg-surface + border classes", () => {
    render(<Card data-testid="card">child</Card>);
    const el = screen.getByTestId("card");
    expect(el.className).toContain("bg-surface");
    expect(el.className).toContain("border-border");
    expect(el.getAttribute("data-variant")).toBe("default");
  });

  test("elevated variant has bg-surface-elevated + shadow", () => {
    render(
      <Card data-testid="card" variant="elevated">
        c
      </Card>,
    );
    const el = screen.getByTestId("card");
    expect(el.className).toContain("bg-surface-elevated");
    expect(el.className).toContain("shadow-md");
  });

  test("outlined variant has transparent background", () => {
    render(
      <Card data-testid="card" variant="outlined">
        c
      </Card>,
    );
    expect(screen.getByTestId("card").className).toContain("bg-transparent");
  });

  test("hover-ring variant carries transition + v-card-hover-ring class", () => {
    render(
      <Card data-testid="card" variant="hover-ring">
        c
      </Card>,
    );
    const el = screen.getByTestId("card");
    expect(el.className).toContain("transition-shadow");
    expect(el.className).toContain("duration-150");
    expect(el.className).toContain("v-card-hover-ring");
  });

  test("forwards extra className alongside variant classes", () => {
    render(
      <Card data-testid="card" className="custom-extra">
        c
      </Card>,
    );
    const el = screen.getByTestId("card");
    expect(el.className).toContain("custom-extra");
    expect(el.className).toContain("bg-surface");
  });

  test("passes through ref", () => {
    let captured: HTMLDivElement | null = null;
    render(
      <Card
        ref={(el) => {
          captured = el;
        }}
        data-testid="card"
      >
        c
      </Card>,
    );
    expect(captured).not.toBeNull();
  });
});
