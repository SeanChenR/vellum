/**
 * Button.test.tsx — primitive contract.
 */

import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

afterEach(() => cleanup());

describe("Button — variants", () => {
  test("primary uses accent-purple background", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button").className).toContain("bg-accent-purple");
  });

  test("secondary uses surface bg with border", () => {
    render(<Button variant="secondary">Cancel</Button>);
    const el = screen.getByRole("button");
    expect(el.className).toContain("bg-surface");
    expect(el.className).toContain("border-border");
  });

  test("ghost is transparent", () => {
    render(<Button variant="ghost">Skip</Button>);
    expect(screen.getByRole("button").className).toContain("bg-transparent");
  });

  test("destructive uses accent-red", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button").className).toContain("text-accent-red");
  });
});

describe("Button — sizes", () => {
  test.each([
    ["sm", "h-8"],
    ["md", "h-10"],
    ["lg", "h-12"],
  ] as const)("size=%s applies %s", (size, height) => {
    render(<Button size={size}>Hi</Button>);
    expect(screen.getByRole("button").className).toContain(height);
  });
});

describe("Button — behaviour", () => {
  test("onClick fires on press", async () => {
    const onClick = mock(() => {});
    render(<Button onClick={onClick}>Hi</Button>);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("disabled prevents onClick", async () => {
    const onClick = mock(() => {});
    render(
      <Button onClick={onClick} disabled>
        Hi
      </Button>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(0);
  });

  test("forwards ref to underlying button", () => {
    let captured: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(el) => {
          captured = el;
        }}
      >
        Hi
      </Button>,
    );
    expect(captured).not.toBeNull();
  });

  test("defaults type to 'button' (avoids accidental form submit)", () => {
    render(<Button>Hi</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });

  test("explicit type='submit' is honored", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });
});
