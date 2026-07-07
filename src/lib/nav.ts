import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  Compass,
  KanbanSquare,
  Mail,
  Settings,
  Share2,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Rankings", href: "/", icon: LayoutGrid, shortcut: "g r" },
  { label: "Universe", href: "/universe", icon: Compass, shortcut: "g u" },
  { label: "Pipeline", href: "/pipeline", icon: KanbanSquare, shortcut: "g p" },
  { label: "Network", href: "/network", icon: Share2, shortcut: "g n" },
  { label: "Monday Report", href: "/monday-report", icon: Mail, shortcut: "g m" },
  { label: "Settings", href: "/settings", icon: Settings, shortcut: "g s" },
];
