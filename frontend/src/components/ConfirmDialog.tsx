"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";

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

  function respond(value: boolean) {
    pending!.resolve(value);
    setPendingState(null);
  }

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && respond(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogDescription>{pending?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => respond(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => respond(true)}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
