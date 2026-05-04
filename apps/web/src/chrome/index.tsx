/**
 * chrome/index.tsx — tldraw `components` prop adapter.
 *
 * Exports `vellumChromeComponents` for use as `<Tldraw components={vellumChromeComponents} />`.
 * TopBar and MainMenu props are injected via the VellumChromeContext provided in Editor.tsx.
 *
 * Design: "Wrap <Tldraw> with components prop, not children-based composition"
 * Design: "Props 透過 React context 注入，避免每次重渲染建新閉包"
 */

import React, { createContext, useContext } from "react";
import { TopBar } from "./TopBar";
import { MainMenu } from "./MainMenu";
import { VellumToolbar } from "../canvas/VellumToolbar";
import type { TopBarProps } from "./TopBar";
import type { MainMenuProps } from "./MainMenu";
import type { TLComponents } from "tldraw";

// ---------------------------------------------------------------------------
// Chrome context
// ---------------------------------------------------------------------------

export interface VellumChromeContextValue {
  topBar: TopBarProps;
  mainMenu: MainMenuProps;
}

export const VellumChromeContext = createContext<VellumChromeContextValue | null>(null);

function useVellumChrome(): VellumChromeContextValue {
  const ctx = useContext(VellumChromeContext);
  if (!ctx) throw new Error("VellumChromeContext not provided");
  return ctx;
}

// ---------------------------------------------------------------------------
// Chrome slot components
// ---------------------------------------------------------------------------

function VellumTopPanel() {
  const { topBar } = useVellumChrome();
  return <TopBar {...topBar} />;
}

function VellumMainMenu() {
  const { mainMenu } = useVellumChrome();
  return <MainMenu {...mainMenu} />;
}

// ---------------------------------------------------------------------------
// tldraw components object
// ---------------------------------------------------------------------------

export const vellumChromeComponents: TLComponents = {
  TopPanel: VellumTopPanel,
  MainMenu: VellumMainMenu,
  // 4 custom shape buttons appended inline with tldraw's built-in tools
  // on the same horizontal toolbar.
  Toolbar: VellumToolbar,
  // Explicitly null to hide tldraw's default slots
  SharePanel: null,
  HelpMenu: null,
  PageMenu: null, // prevent multi-page UI
};
