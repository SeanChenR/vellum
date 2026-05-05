/**
 * AppLayout — shell for authenticated routes (Dashboard, Profile,
 * Sessions, and any future authenticated route except the canvas
 * editor).
 *
 * Spec: public-pages — "Authenticated routes share an AppLayout shell
 * that reuses the Navbar". Reuses the same Navbar as PublicLayout but
 * does NOT render the Footer or the mobile graceful notice — those
 * belong to the public marketing surface.
 *
 * The canvas editor route (/canvas/:id) keeps its own TopBar and is
 * NOT wrapped in AppLayout.
 */

import React, { type ReactNode } from "react";
import { Navbar } from "./Navbar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-off-white text-ink-navy">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
