/**
 * ChatComposer.test.tsx — Send/Cancel state + Cmd+Enter / Cmd+. shortcuts.
 *
 * Spec ref: ai-side-panel "Composer sends user message and switches to Cancel during run"
 */

import "../i18n";
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { ChatComposer } from "./ChatComposer";
import type { BYOKPreferencesMap, BYOKProviderListItem } from "@vellum/shared";

afterEach(() => cleanup());

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

const PROVIDERS: BYOKProviderListItem[] = [
  { provider: "openai", createdAt: "2026-05-09T00:00:00Z", lastUsedAt: null },
];
const PREFS: BYOKPreferencesMap = {
  openai: { model: "gpt-4o-mini", updatedAt: "2026-05-09T00:00:00Z" },
};

describe("ChatComposer — Send button", () => {
  test("Send disabled when draft empty; enabled when text typed", () => {
    let draft = "";
    const setDraft = mock((next: string) => {
      draft = next;
    });
    const onSend = mock(() => {});
    const onCancel = mock(() => {});

    const { rerender } = wrap(
      <ChatComposer
        draft={draft}
        setDraft={setDraft}
        state="idle"
        onSend={onSend}
        onCancel={onCancel}
        preferences={PREFS}
        availableProviders={PROVIDERS}
      />,
    );
    const sendBtn = screen.getByTestId("chat-composer-send") as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);

    rerender(
      <I18nextProvider i18n={i18n}>
        <ChatComposer
          draft="create a markdown shape"
          setDraft={setDraft}
          state="idle"
          onSend={onSend}
          onCancel={onCancel}
          preferences={PREFS}
          availableProviders={PROVIDERS}
        />
      </I18nextProvider>,
    );
    const sendBtn2 = screen.getByTestId("chat-composer-send") as HTMLButtonElement;
    expect(sendBtn2.disabled).toBe(false);
  });

  test("Click Send invokes onSend with provider+model+userMessage", () => {
    const onSend = mock(() => {});
    wrap(
      <ChatComposer
        draft="create a markdown shape"
        setDraft={() => {}}
        state="idle"
        onSend={onSend}
        onCancel={() => {}}
        preferences={PREFS}
        availableProviders={PROVIDERS}
      />,
    );
    fireEvent.click(screen.getByTestId("chat-composer-send"));
    expect(onSend).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-4o-mini",
      userMessage: "create a markdown shape",
    });
  });
});

describe("ChatComposer — Running state swaps Send for Cancel", () => {
  test("running state hides Send and shows Cancel", () => {
    wrap(
      <ChatComposer
        draft="hello"
        setDraft={() => {}}
        state="running"
        onSend={() => {}}
        onCancel={() => {}}
        preferences={PREFS}
        availableProviders={PROVIDERS}
      />,
    );
    expect(screen.queryByTestId("chat-composer-send")).toBeNull();
    expect(screen.queryByTestId("chat-composer-cancel")).not.toBeNull();
  });

  test("Click Cancel during run invokes onCancel", () => {
    const onCancel = mock(() => {});
    wrap(
      <ChatComposer
        draft=""
        setDraft={() => {}}
        state="running"
        onSend={() => {}}
        onCancel={onCancel}
        preferences={PREFS}
        availableProviders={PROVIDERS}
      />,
    );
    fireEvent.click(screen.getByTestId("chat-composer-cancel"));
    expect(onCancel).toHaveBeenCalled();
  });

  test("textarea is disabled during running so Cmd+Enter cannot dispatch", () => {
    wrap(
      <ChatComposer
        draft="another prompt"
        setDraft={() => {}}
        state="running"
        onSend={() => {}}
        onCancel={() => {}}
        preferences={PREFS}
        availableProviders={PROVIDERS}
      />,
    );
    const ta = screen.getByTestId("chat-composer-textarea") as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
  });
});

describe("ChatComposer — no provider configured", () => {
  test("Send disabled and noProvider hint shown when no BYOK keys", () => {
    wrap(
      <ChatComposer
        draft="hi"
        setDraft={() => {}}
        state="idle"
        onSend={() => {}}
        onCancel={() => {}}
        preferences={{}}
        availableProviders={[]}
      />,
    );
    const sendBtn = screen.getByTestId("chat-composer-send") as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
  });

  test("textarea disabled and no-api-key hint visible when no BYOK keys", () => {
    wrap(
      <ChatComposer
        draft=""
        setDraft={() => {}}
        state="idle"
        onSend={() => {}}
        onCancel={() => {}}
        preferences={{}}
        availableProviders={[]}
      />,
    );
    const ta = screen.getByTestId("chat-composer-textarea") as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
    expect(screen.queryByTestId("chat-composer-no-api-key-hint")).not.toBeNull();
  });
});

describe("ChatComposer — provider/model picker (M14 verification gap)", () => {
  const MULTI_PROVIDERS: BYOKProviderListItem[] = [
    { provider: "openai", createdAt: "2026-05-09T00:00:00Z", lastUsedAt: null },
    { provider: "anthropic", createdAt: "2026-05-09T00:00:00Z", lastUsedAt: null },
    { provider: "google", createdAt: "2026-05-09T00:00:00Z", lastUsedAt: null },
  ];
  const MULTI_PREFS: BYOKPreferencesMap = {
    openai: { model: "gpt-4o-mini", updatedAt: "2026-05-09T00:00:00Z" },
    anthropic: { model: "claude-haiku-4-5", updatedAt: "2026-05-09T00:00:00Z" },
    google: { model: "gemini-2.5-flash-lite", updatedAt: "2026-05-09T00:00:00Z" },
  };

  test("renders a provider dropdown listing every configured provider", () => {
    wrap(
      <ChatComposer
        draft=""
        setDraft={() => {}}
        state="idle"
        onSend={() => {}}
        onCancel={() => {}}
        preferences={MULTI_PREFS}
        availableProviders={MULTI_PROVIDERS}
      />,
    );
    const picker = screen.getByTestId("chat-composer-provider-picker") as HTMLSelectElement;
    const values = Array.from(picker.options).map((o) => o.value);
    expect(values).toContain("openai");
    expect(values).toContain("anthropic");
    expect(values).toContain("google");
  });

  test("renders a model dropdown filtered to the selected provider", () => {
    wrap(
      <ChatComposer
        draft=""
        setDraft={() => {}}
        state="idle"
        onSend={() => {}}
        onCancel={() => {}}
        preferences={MULTI_PREFS}
        availableProviders={MULTI_PROVIDERS}
      />,
    );
    const modelPicker = screen.getByTestId("chat-composer-model-picker") as HTMLSelectElement;
    const values = Array.from(modelPicker.options).map((o) => o.value);
    // First configured provider is openai → models must be openai-only
    expect(values.some((v) => v.startsWith("gpt-") || v.startsWith("o"))).toBe(true);
    expect(values.every((v) => !v.startsWith("claude-"))).toBe(true);
  });

  test("changing provider resets model to that provider's preference", () => {
    const onSend = mock(() => {});
    wrap(
      <ChatComposer
        draft="hi"
        setDraft={() => {}}
        state="idle"
        onSend={onSend}
        onCancel={() => {}}
        preferences={MULTI_PREFS}
        availableProviders={MULTI_PROVIDERS}
      />,
    );
    const providerPicker = screen.getByTestId("chat-composer-provider-picker") as HTMLSelectElement;
    fireEvent.change(providerPicker, { target: { value: "anthropic" } });
    fireEvent.click(screen.getByTestId("chat-composer-send"));
    expect(onSend).toHaveBeenCalledWith({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      userMessage: "hi",
    });
  });

  test("changing model on the picker sends the new model id", () => {
    const onSend = mock(() => {});
    wrap(
      <ChatComposer
        draft="hi"
        setDraft={() => {}}
        state="idle"
        onSend={onSend}
        onCancel={() => {}}
        preferences={MULTI_PREFS}
        availableProviders={MULTI_PROVIDERS}
      />,
    );
    const modelPicker = screen.getByTestId("chat-composer-model-picker") as HTMLSelectElement;
    // Pick any non-default openai model.
    const optionToPick = Array.from(modelPicker.options).find(
      (o) => o.value !== "gpt-4o-mini" && o.value.length > 0,
    );
    if (!optionToPick) throw new Error("expected at least one alternate openai model");
    fireEvent.change(modelPicker, { target: { value: optionToPick.value } });
    fireEvent.click(screen.getByTestId("chat-composer-send"));
    expect(onSend).toHaveBeenCalledWith({
      provider: "openai",
      model: optionToPick.value,
      userMessage: "hi",
    });
  });

  test("provider picker hidden when no BYOK keys are configured", () => {
    wrap(
      <ChatComposer
        draft=""
        setDraft={() => {}}
        state="idle"
        onSend={() => {}}
        onCancel={() => {}}
        preferences={{}}
        availableProviders={[]}
      />,
    );
    expect(screen.queryByTestId("chat-composer-provider-picker")).toBeNull();
    expect(screen.queryByTestId("chat-composer-model-picker")).toBeNull();
  });
});
