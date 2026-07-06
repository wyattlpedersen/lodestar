import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center",
        className
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.5} />
      </div>
      <div className="max-w-sm space-y-1">
        <h2 className="font-display text-base font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
