"use client";

import { Monitor, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUiStore } from "@/lib/stores/ui-store";

export function PresentationToggle() {
  const presentationMode = useUiStore((s) => s.presentationMode);
  const toggle = useUiStore((s) => s.togglePresentationMode);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={toggle}
            aria-label={
              presentationMode
                ? "Switch to terminal mode"
                : "Switch to presentation mode"
            }
          >
            {presentationMode ? (
              <Monitor className="size-4" />
            ) : (
              <Presentation className="size-4" />
            )}
          </Button>
        }
      />
      <TooltipContent>
        {presentationMode ? "Terminal mode" : "Presentation mode"}
      </TooltipContent>
    </Tooltip>
  );
}
