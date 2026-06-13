interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

/**
 * Dismissible error banner pinned to the top of the app. VSCode-error-ish:
 * dark red background, light text, an × to dismiss.
 */
export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner-text">{message}</span>
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
