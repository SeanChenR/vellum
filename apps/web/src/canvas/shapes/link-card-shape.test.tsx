/**
 * link-card-shape tests — view component for the Link card shape.
 *
 * Spec: canvas-shapes — Link card transitions through pending / success
 * / error states; on success render OG card, on error render
 * "Preview unavailable" placeholder + favicon + retry.
 */

import "../../i18n";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { LinkCardShapeView } from "./link-card-shape";

afterEach(cleanup);

beforeEach(async () => {
  await i18n.changeLanguage("zh-TW");
});

function withI18n(node: React.ReactElement) {
  return <I18nextProvider i18n={i18n}>{node}</I18nextProvider>;
}

describe("LinkCardShapeView — success state", () => {
  test("renders title, description, site name from metadata", () => {
    render(
      withI18n(
        <LinkCardShapeView
          stored={{
            state: "success",
            url: "https://example.com",
            fetchedAt: "2026-05-04T10:00:00.000Z",
            metadata: {
              title: "Example Title",
              description: "Example description",
              siteName: "Example Inc.",
              image: "https://example.com/img.png",
              favicon: "https://example.com/favicon.ico",
            },
          }}
          locked={false}
          lockedBy={null}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(screen.queryByText("Example Title")).not.toBeNull();
    expect(screen.queryByText("Example description")).not.toBeNull();
    expect(screen.queryByText("Example Inc.")).not.toBeNull();
  });
});

describe("LinkCardShapeView — error state", () => {
  test("renders 'Preview unavailable' placeholder + favicon + retry button", async () => {
    const onRetry = mock(() => undefined);
    const user = userEvent.setup();
    render(
      withI18n(
        <LinkCardShapeView
          stored={{
            state: "error",
            url: "https://example.com/post",
            fetchedAt: null,
            metadata: null,
          }}
          locked={false}
          lockedBy={null}
          onRetry={onRetry}
        />,
      ),
    );
    expect(screen.queryByText(/無法載入預覽|preview unavailable/i)).not.toBeNull();
    // Favicon: derived from URL origin if metadata is null
    const favicon = screen.getByTestId("link-card-favicon");
    expect(favicon).toBeTruthy();
    const retry = screen.getByRole("button", { name: /重新嘗試|try again/i });
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("LinkCardShapeView — pending state", () => {
  test("renders loading indicator (no card content yet)", () => {
    render(
      withI18n(
        <LinkCardShapeView
          stored={{
            state: "pending",
            url: "https://example.com",
            fetchedAt: null,
            metadata: null,
          }}
          locked={false}
          lockedBy={null}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(screen.queryByText(/載入連結預覽中|loading link preview/i)).not.toBeNull();
  });
});

describe("LinkCardShapeView — lock state", () => {
  test("locked view shows lock badge", () => {
    render(
      withI18n(
        <LinkCardShapeView
          stored={{
            state: "success",
            url: "https://example.com",
            fetchedAt: "2026-05-04T10:00:00.000Z",
            metadata: { title: "Example" },
          }}
          locked={true}
          lockedBy={{ userId: "u-x", userName: "Dave" }}
          onRetry={() => undefined}
        />,
      ),
    );
    expect(screen.getByText(/Dave/)).toBeTruthy();
  });
});
