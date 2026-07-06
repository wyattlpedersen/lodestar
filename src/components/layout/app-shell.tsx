"use client";

import * as React from "react";
import { SidebarNav } from "./sidebar-nav";
import { CommandPalette } from "./command-palette";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { PresentationToggle } from "./presentation-toggle";
import { ComplianceFooter } from "@/components/compliance-footer";
import { initPresentationModeFromStorage, useUiStore } from "@/lib/stores/ui-store";
import { Search } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    initPresentationModeFromStorage();
  }, []);

  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background print:h-auto print:overflow-visible">
      <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar no-print">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="font-display text-lg font-semibold tracking-tight text-sidebar-foreground">
            LODESTAR
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          <SidebarNav />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <ComplianceFooter />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4 no-print">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Search className="size-3.5" />
            <span>Search or jump to...</span>
            <kbd className="ml-4 rounded border border-border bg-background px-1 font-mono text-[10px]">
              ⌘K
            </kbd>
          </button>
          <PresentationToggle />
        </header>
        <main className="flex-1 overflow-y-auto print:h-auto print:overflow-visible">
          {children}
        </main>
      </div>

      <CommandPalette />
      <KeyboardShortcuts />
    </div>
  );
}
