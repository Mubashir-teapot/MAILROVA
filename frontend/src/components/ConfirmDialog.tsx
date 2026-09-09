"use client";

import { useEffect, useState } from "react";

interface PendingConfirm {
  message: string;
  resolve: (value: boolean) => void;
}

let setPending: ((p: PendingConfirm | null) => void) | null = null;

// Drop-in replacement for `window.confirm()` that matches this app's visual
// style instead of the browser's native dialog — same call shape
// (`if (!(await confirmDialog("..."))) return;`), just Promise-based since a
// styled dialog can't block synchronously the way window.confirm() does.
export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setPending) {
      // ConfirmDialogHost isn't mounted (shouldn't happen — it's in Layout) — fall back rather than hang forever.
      resolve(window.confirm(message));
      return;
    }
    setPending({ message, resolve });
  });
}

// Mounted once in Layout.tsx — every confirmDialog() call anywhere in the
// app renders through this single host.
export function ConfirmDialogHost() {
  const [pending, setPendingState] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    setPending = setPendingState;
    return () => {
      setPending = null;
    };
  }, []);

  if (!pending) return null;

  function respond(value: boolean) {
    pending!.resolve(value);
    setPendingState(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => respond(false)}>
      <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-slate-700 dark:text-slate-200">{pending.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => respond(false)}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => respond(true)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
