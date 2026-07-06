"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <span className="flex items-center gap-2.5">
              <Icon
                className={cn(
                  "size-4",
                  active ? "text-gold" : "text-sidebar-foreground/50"
                )}
                strokeWidth={1.75}
              />
              {item.label}
            </span>
            {item.shortcut && (
              <span className="hidden font-mono text-[10px] uppercase tracking-wider text-sidebar-foreground/30 group-hover:text-sidebar-foreground/50 md:inline">
                {item.shortcut}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
