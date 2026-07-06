"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useUiStore } from "@/lib/stores/ui-store";
import { NAV_ITEMS } from "@/lib/nav";
import { RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";

export function CommandPalette() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [rescoring, setRescoring] = React.useState(false);

  async function rescoreAll() {
    setOpen(false);
    setRescoring(true);
    try {
      const weightProfile = await fetch("/api/settings/weights").then((r) => r.json());
      const res = await fetch("/api/scoring/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightProfile }),
      });
      if (!res.ok) throw new Error("Rescore failed");
      const data = await res.json();
      toast.success(`Rescored ${data.scored} orgs.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rescore failed");
    } finally {
      setRescoring(false);
    }
  }

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandPaletteOpen);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a screen, or run a command..." />
      <CommandList>
        <CommandEmpty>No matches. Try a different term.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => go(item.href)}>
              <item.icon className="text-muted-foreground" />
              {item.label}
              {item.shortcut && (
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={rescoreAll} value="refresh all rescore" disabled={rescoring}>
            <RefreshCw className={rescoring ? "animate-spin text-muted-foreground" : "text-muted-foreground"} />
            Rescore all orgs
          </CommandItem>
          <CommandItem
            onSelect={() => go("/settings")}
            value="export csv data"
          >
            <Download className="text-muted-foreground" />
            Export CSV
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
