"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/lib/stores/ui-store";

const G_ROUTES: Record<string, string> = {
  r: "/",
  u: "/universe",
  p: "/pipeline",
  m: "/monday-report",
  s: "/settings",
};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || el.isContentEditable;
}

/**
 * Global shortcuts (Section 9 F13): `g` then a letter jumps to a section,
 * `/` opens the command palette (the app's one search surface), `j`/`k`/Enter
 * are handled locally by tables that opt in via data-row-nav.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const pendingG = React.useRef(false);
  const gTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimeout.current) clearTimeout(gTimeout.current);
        const route = G_ROUTES[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          router.push(route);
        }
        return;
      }

      if (e.key === "g") {
        pendingG.current = true;
        gTimeout.current = setTimeout(() => {
          pendingG.current = false;
        }, 600);
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (gTimeout.current) clearTimeout(gTimeout.current);
    };
  }, [router, setCommandPaletteOpen]);

  return null;
}
