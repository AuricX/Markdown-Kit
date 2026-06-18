import { useEffect, useRef } from "react";

export function useKeyboardShortcuts(h: { onSave: () => void }): void {
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        ref.current.onSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
