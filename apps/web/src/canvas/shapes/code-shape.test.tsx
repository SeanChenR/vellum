/**
 * code-shape tests — read-only view (editing now happens in a dialog).
 *
 * Tested behaviour:
 *  - Renders language label
 *  - Copy button writes source to clipboard + shows "copied" feedback
 *  - Double-click on an unlocked shape triggers onRequestEdit
 *  - Locked state shows lock badge and absorbs double-click
 *
 * Spec: canvas-shapes — Code shape view (editing via dialog, M6
 * acceptance feedback).
 */

import "../../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";

const writeToClipboardMock = mock(async (_text: string) => undefined);
mock.module("./clipboard", () => ({
  writeToClipboard: writeToClipboardMock,
}));

import { CodeShapeView } from "./code-shape";

afterEach(() => {
  cleanup();
  writeToClipboardMock.mockClear();
});

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

function withI18n(node: React.ReactElement) {
  return <I18nextProvider i18n={i18n}>{node}</I18nextProvider>;
}

describe("CodeShapeView — language label", () => {
  test("renders the localized language name in the header", () => {
    render(
      withI18n(
        <CodeShapeView
          source="print('hi')"
          language="python"
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    expect(screen.getByTestId("code-shape-language").textContent).toBe("Python");
  });
});

describe("CodeShapeView — Copy button", () => {
  test("clicking Copy writes source to clipboard + shows 'copied' feedback", async () => {
    const user = userEvent.setup();
    render(
      withI18n(
        <CodeShapeView
          source="print('hi')"
          language="python"
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    const copyBtn = screen.getByRole("button", { name: /複製|copy/i });
    await user.click(copyBtn);
    await new Promise((r) => setTimeout(r, 0));
    expect(writeToClipboardMock).toHaveBeenCalledTimes(1);
    expect(writeToClipboardMock).toHaveBeenCalledWith("print('hi')");
    expect(screen.queryByText(/已複製|copied/i)).not.toBeNull();
  });
});

describe("CodeShapeView — double-click opens edit dialog (via callback)", () => {
  test("unlocked: double-click triggers onRequestEdit", async () => {
    const user = userEvent.setup();
    const onRequestEdit = mock(() => undefined);
    render(
      withI18n(
        <CodeShapeView
          source=""
          language="python"
          locked={false}
          lockedBy={null}
          onRequestEdit={onRequestEdit}
        />,
      ),
    );
    const root = screen.getByTestId("code-shape-root");
    await user.dblClick(root);
    expect(onRequestEdit).toHaveBeenCalledTimes(1);
  });

  test("locked: double-click does NOT trigger onRequestEdit", async () => {
    const user = userEvent.setup();
    const onRequestEdit = mock(() => undefined);
    render(
      withI18n(
        <CodeShapeView
          source=""
          language="python"
          locked={true}
          lockedBy={{ userId: "u-x", userName: "Bob" }}
          onRequestEdit={onRequestEdit}
        />,
      ),
    );
    const root = screen.getByTestId("code-shape-root");
    await user.dblClick(root);
    expect(onRequestEdit).not.toHaveBeenCalled();
  });
});

describe("CodeShapeView — lock badge", () => {
  test("locked state shows the locker's name in a badge", () => {
    render(
      withI18n(
        <CodeShapeView
          source=""
          language="python"
          locked={true}
          lockedBy={{ userId: "u-x", userName: "Carol" }}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    expect(screen.queryByText(/Carol/)).not.toBeNull();
  });
});
