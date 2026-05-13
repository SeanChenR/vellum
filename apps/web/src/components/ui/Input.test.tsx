import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Input } from "./Input";

afterEach(() => cleanup());

describe("Input", () => {
  test("renders label associated with the input via htmlFor", () => {
    render(<Input label="Email" placeholder="you@example.com" />);
    const label = screen.getByText("Email");
    const input = screen.getByPlaceholderText("you@example.com");
    expect(label.getAttribute("for")).toBe(input.getAttribute("id"));
  });

  test("renders icon and applies left padding when icon prop is set", () => {
    render(<Input placeholder="search" icon={<svg data-testid="my-icon" />} />);
    expect(screen.getByTestId("input-icon")).toBeDefined();
    expect(screen.getByTestId("my-icon")).toBeDefined();
    expect(screen.getByPlaceholderText("search").className).toContain("pl-[38px]");
  });

  test("renders error message and adds accent-red border", () => {
    render(<Input placeholder="x" error="too long" />);
    expect(screen.getByTestId("input-error").textContent).toBe("too long");
    expect(screen.getByPlaceholderText("x").className).toContain("border-accent-red");
  });

  test("error takes precedence over hint", () => {
    render(<Input placeholder="x" hint="hint here" error="oops" />);
    expect(screen.queryByTestId("input-hint")).toBeNull();
    expect(screen.getByTestId("input-error")).toBeDefined();
  });

  test("renders suffix node on the right", () => {
    render(<Input placeholder="x" suffix="px" />);
    expect(screen.getByTestId("input-suffix").textContent).toBe("px");
  });

  test("disabled prop applies disabled styling", () => {
    render(<Input placeholder="x" disabled />);
    expect(screen.getByPlaceholderText("x").className).toContain("disabled:opacity-50");
  });
});
