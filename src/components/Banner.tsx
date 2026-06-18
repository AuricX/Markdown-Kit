import { CircleAlert, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerProps {
  message: string;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "error" | "info";
}

export default function Banner({ message, onDismiss, actionLabel, onAction, variant = "error" }: BannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-2 border-b border-border px-3 py-1.5 text-sm",
        variant === "error"
          ? "bg-destructive text-destructive-foreground"
          : "bg-secondary text-secondary-foreground"
      )}
    >
      <CircleAlert className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 hover:bg-black/10"
        >
          <RotateCw className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={onDismiss} className="rounded p-0.5 hover:bg-black/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
