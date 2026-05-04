/**
 * markdown-shape tests — interaction layer (TDD).
 *
 * Spec: canvas-shapes — "Markdown shape opens a dialog editor on double-click"
 * + lock interplay from multiplayer-sync.
 *
 * Tested behaviours:
 *  - Double-clicking a non-locked shape opens the editor dialog
 *  - Saving from the dialog calls onSubmit with the new content
 *  - Cancelling (Esc / Cancel button) closes the dialog without onSubmit
 *  - Lock badge renders when `locked=true`; double-click is a no-op
 *
 * The tldraw ShapeUtil glue is thin and tested via manual review; logic
 * lives in MarkdownShapeView (props-driven) and MarkdownEditDialog
 * (dialog-driven) components which are unit-testable.
 */

import "../../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { MarkdownEditDialog, MarkdownShapeView } from "./markdown-shape";

afterEach(cleanup);

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

function withI18n(node: React.ReactElement) {
  return <I18nextProvider i18n={i18n}>{node}</I18nextProvider>;
}

describe("MarkdownShapeView — render + interaction", () => {
  test("renders parsed HTML for the given content", () => {
    render(
      withI18n(
        <MarkdownShapeView
          content="# Hello"
          locked={false}
          lockedBy={null}
          onRequestEdit={() => undefined}
        />,
      ),
    );
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Hello");
  });

  test("double-click on an unlocked view triggers onRequestEdit", () => {
    const onRequestEdit = mock(() => undefined);
    render(
      withI18n(
        <MarkdownShapeView
          content="# Hello"
          locked={false}
          lockedBy={null}
          onRequestEdit={onRequestEdit}
        />,
      ),
    );
    const root = screen.getByTestId("markdown-shape-root");
    fireEvent.doubleClick(root);
    expect(onRequestEdit).toHaveBeenCalledTimes(1);
  });

  test("double-click on a locked view is a no-op + lock badge appears", () => {
    const onRequestEdit = mock(() => undefined);
    render(
      withI18n(
        <MarkdownShapeView
          content="# Hello"
          locked={true}
          lockedBy={{ userId: "u-other", userName: "Bob" }}
          onRequestEdit={onRequestEdit}
        />,
      ),
    );
    const root = screen.getByTestId("markdown-shape-root");
    fireEvent.doubleClick(root);
    expect(onRequestEdit).not.toHaveBeenCalled();
    // Lock badge surfaces locker's name via the localized key
    expect(screen.getByText(/Bob/)).toBeTruthy();
  });
});

describe("MarkdownEditDialog — save / cancel flow", () => {
  test("Save calls onSubmit with the (possibly edited) textarea content", async () => {
    const user = userEvent.setup();
    const onSubmit = mock((_value: string) => undefined);
    const onCancel = mock(() => undefined);
    render(
      withI18n(
        <MarkdownEditDialog
          open
          initialContent="# Hello"
          onSubmit={onSubmit}
          onCancel={onCancel}
        />,
      ),
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, "# Updated");
    const saveBtn = screen.getByRole("button", { name: /儲存|save/i });
    await user.click(saveBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("# Updated");
    expect(onCancel).not.toHaveBeenCalled();
  });

  test("Escape key closes dialog via onCancel and does NOT call onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = mock((_value: string) => undefined);
    const onCancel = mock(() => undefined);
    render(
      withI18n(
        <MarkdownEditDialog
          open
          initialContent="# Hello"
          onSubmit={onSubmit}
          onCancel={onCancel}
        />,
      ),
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, "discarded");
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("Cancel button closes dialog via onCancel without onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = mock((_value: string) => undefined);
    const onCancel = mock(() => undefined);
    render(
      withI18n(
        <MarkdownEditDialog
          open
          initialContent="# Hello"
          onSubmit={onSubmit}
          onCancel={onCancel}
        />,
      ),
    );
    const cancelBtn = screen.getByRole("button", { name: /取消|cancel/i });
    await user.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("dialog is not visible when open=false", () => {
    render(
      withI18n(
        <MarkdownEditDialog
          open={false}
          initialContent="# Hello"
          onSubmit={() => undefined}
          onCancel={() => undefined}
        />,
      ),
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
