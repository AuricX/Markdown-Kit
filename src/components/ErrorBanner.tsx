interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  /** Optional inline action (e.g. "Reload" on an external-change notice). */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Dismissible banner pinned to the top of the app. VSCode-error-ish: dark red
 * background, light text, an optional action button, and an × to dismiss.
 */
export default function ErrorBanner({
  message,
  onDismiss,
  actionLabel,
  onAction,
}: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner-text">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          className="error-banner-action"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        className="error-banner-dismiss"
        aria-label="Dismiss error"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
