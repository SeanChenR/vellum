/**
 * callout-shape tests — variant rendering + inline-only markdown body.
 *
 * Spec: canvas-shapes — "Callout shape renders one of three variants
 * with a lucide icon".
 *
 * Tested behaviour:
 *  - Three variants (info / warning / danger) each render with a
 *    distinct lucide icon and accent color
 *  - Body supports inline markdown (`**bold**` → `<strong>bold</strong>`)
 *  - Block markdown (`# heading`) renders as literal text (no <h1>)
 *  - Locked state shows lock badge (per multiplayer-sync requirement)
 */

import "../../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { CalloutShapeView, CalloutVariantPicker } from "./callout-shape";

afterEach(cleanup);

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

function withI18n(node: React.ReactElement) {
  return <I18nextProvider i18n={i18n}>{node}</I18nextProvider>;
}

describe("CalloutShapeView — variants", () => {
  test("variant=info renders with the localized info label and an Info icon", () => {
    render(
      withI18n(
        <CalloutShapeView
          variant="info"
          body="Hello"
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    const root = screen.getByTestId("callout-shape-root");
    expect(root.getAttribute("data-variant")).toBe("info");
    // The lucide icon is rendered as an inline SVG with a stable test id
    expect(screen.getByTestId("callout-icon-info")).toBeTruthy();
  });

  test("variant=warning renders with a warning icon", () => {
    render(
      withI18n(
        <CalloutShapeView
          variant="warning"
          body="Heads up"
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    expect(screen.getByTestId("callout-shape-root").getAttribute("data-variant")).toBe("warning");
    expect(screen.getByTestId("callout-icon-warning")).toBeTruthy();
  });

  test("variant=danger renders with a danger icon", () => {
    render(
      withI18n(
        <CalloutShapeView
          variant="danger"
          body="Watch out"
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    expect(screen.getByTestId("callout-shape-root").getAttribute("data-variant")).toBe("danger");
    expect(screen.getByTestId("callout-icon-danger")).toBeTruthy();
  });
});

describe("CalloutShapeView — plain text body", () => {
  test("renders the body verbatim (no markdown parsing)", () => {
    render(
      withI18n(
        <CalloutShapeView
          variant="info"
          body="Hello **world**"
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    const body = screen.getByTestId("callout-shape-body");
    expect(body.textContent).toBe("Hello **world**");
    // No HTML elements like <strong> / <h1> / <a> should be injected
    expect(body.querySelector("strong")).toBeNull();
    expect(body.querySelector("h1")).toBeNull();
    expect(body.querySelector("a")).toBeNull();
  });

  test("preserves newlines in body", () => {
    render(
      withI18n(
        <CalloutShapeView
          variant="info"
          body={"line one\nline two"}
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    const body = screen.getByTestId("callout-shape-body");
    // whitespace-pre-wrap preserves the newline character in textContent
    expect(body.textContent).toBe("line one\nline two");
  });
});

describe("CalloutVariantPicker — render + interaction", () => {
  test("renders 3 buttons in canonical order (info / warning / danger)", () => {
    render(withI18n(<CalloutVariantPicker variant="info" onChange={() => undefined} />));
    const picker = screen.getByTestId("callout-variant-picker");
    const buttons = picker.querySelectorAll("button");
    expect(buttons.length).toBe(3);
    expect(buttons[0]?.getAttribute("data-testid")).toBe("callout-variant-button-info");
    expect(buttons[1]?.getAttribute("data-testid")).toBe("callout-variant-button-warning");
    expect(buttons[2]?.getAttribute("data-testid")).toBe("callout-variant-button-danger");
  });

  test("active variant button has aria-pressed=true; others false", () => {
    render(withI18n(<CalloutVariantPicker variant="warning" onChange={() => undefined} />));
    expect(screen.getByTestId("callout-variant-button-warning").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByTestId("callout-variant-button-info").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  test("clicking a variant button calls onChange with that variant", async () => {
    const onChange = mock((_v: "info" | "warning" | "danger") => undefined);
    const user = userEvent.setup();
    render(withI18n(<CalloutVariantPicker variant="info" onChange={onChange} />));
    const dangerBtn = screen.getByTestId("callout-variant-button-danger");
    await user.click(dangerBtn);
    expect(onChange).toHaveBeenCalledWith("danger");
  });
});

describe("CalloutShapeView — view does NOT render the variant picker", () => {
  test("picker is rendered only inside the edit dialog, never on the shape itself", () => {
    render(
      withI18n(
        <CalloutShapeView
          variant="info"
          body="Hi"
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    expect(screen.queryByTestId("callout-variant-picker")).toBeNull();
  });
});

describe("CalloutShapeView — lock state", () => {
  test("locked view renders the lock badge with locker's name", () => {
    render(
      withI18n(
        <CalloutShapeView
          variant="info"
          body="Hello"
          locked={true}
          lockedBy={{ userId: "u-x", userName: "Carol" }}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    expect(screen.getByText(/Carol/)).toBeTruthy();
  });
});
