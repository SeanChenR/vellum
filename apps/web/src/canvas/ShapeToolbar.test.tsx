/**
 * ShapeToolbar tests — 4 custom shape insertion buttons.
 *
 * Spec: canvas-editor — "Canvas toolbar exposes four custom shape
 * insertion buttons".
 *
 * Tested behaviour (props-driven, no tldraw editor mock needed):
 *  - 4 buttons render in fixed order: Markdown, Code, Callout, Link card
 *  - Tooltips localize per active language
 *  - Clicking a button calls onInsert with the matching shape kind
 */

import "../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ShapeToolbar, type ShapeKind } from "./ShapeToolbar";

afterEach(cleanup);

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

function withI18n(node: React.ReactElement) {
  return <I18nextProvider i18n={i18n}>{node}</I18nextProvider>;
}

describe("ShapeToolbar — render order", () => {
  test("renders 4 buttons in order Markdown, Code, Callout, Link card", () => {
    render(withI18n(<ShapeToolbar onInsert={() => undefined} />));
    const buttons = screen.getAllByRole("button");
    const ids = buttons.map((b) => b.getAttribute("data-shape-kind"));
    expect(ids).toEqual(["markdown", "code", "callout", "link-card"]);
  });
});

describe("ShapeToolbar — onInsert dispatch", () => {
  test("clicking Markdown button calls onInsert('markdown')", async () => {
    const onInsert = mock((_k: ShapeKind) => undefined);
    const user = userEvent.setup();
    render(withI18n(<ShapeToolbar onInsert={onInsert} />));
    const btn = screen.getByRole("button", { name: /插入 Markdown|insert markdown/i });
    await user.click(btn);
    expect(onInsert).toHaveBeenCalledWith("markdown");
  });

  test("clicking Code button calls onInsert('code')", async () => {
    const onInsert = mock((_k: ShapeKind) => undefined);
    const user = userEvent.setup();
    render(withI18n(<ShapeToolbar onInsert={onInsert} />));
    const btn = screen.getByRole("button", { name: /插入程式碼|insert code/i });
    await user.click(btn);
    expect(onInsert).toHaveBeenCalledWith("code");
  });

  test("clicking Callout button calls onInsert('callout')", async () => {
    const onInsert = mock((_k: ShapeKind) => undefined);
    const user = userEvent.setup();
    render(withI18n(<ShapeToolbar onInsert={onInsert} />));
    const btn = screen.getByRole("button", { name: /插入提示框|insert callout/i });
    await user.click(btn);
    expect(onInsert).toHaveBeenCalledWith("callout");
  });

  test("clicking Link card button calls onInsert('link-card')", async () => {
    const onInsert = mock((_k: ShapeKind) => undefined);
    const user = userEvent.setup();
    render(withI18n(<ShapeToolbar onInsert={onInsert} />));
    const btn = screen.getByRole("button", { name: /插入連結卡片|insert link card/i });
    await user.click(btn);
    expect(onInsert).toHaveBeenCalledWith("link-card");
  });
});

describe("ShapeToolbar — i18n", () => {
  test("tooltips switch when active language changes", async () => {
    await i18n.changeLanguage("en");
    render(withI18n(<ShapeToolbar onInsert={() => undefined} />));
    expect(screen.queryByRole("button", { name: /insert markdown/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /insert code/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /insert callout/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /insert link card/i })).not.toBeNull();
  });
});
