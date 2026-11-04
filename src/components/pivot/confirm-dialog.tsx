"use client";

import { useEffect, useId, useRef, useState } from "react";

// For the few actions that cannot be undone. A native modal <dialog> keeps focus inside,
// closes on Escape and returns focus to the button that opened it.

export function ConfirmDialog({ open, title, children, confirmLabel, confirmWord, busy = false, error, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  /** Names the action, e.g. "Delete all my data". */
  confirmLabel: string;
  /** When set, the user types this word to enable the confirm button. */
  confirmWord?: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) { setTyped(""); dialog.showModal(); }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const ready = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();

  return (
    <dialog ref={ref} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={bodyId} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} onClick={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <form method="dialog" className="confirm-dialog-body" onSubmit={(event) => { event.preventDefault(); if (ready && !busy) onConfirm(); }}>
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className="confirm-dialog-copy">{children}</div>
        {confirmWord && (
          <>
            <label className="field-label" htmlFor={inputId}>Type “{confirmWord}” to confirm</label>
            <input id={inputId} className="text-input" autoFocus value={typed} autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={(event) => setTyped(event.target.value)} />
          </>
        )}
        {error && <p className="form-status" role="alert">{error}</p>}
        <div className="confirm-dialog-actions">
          <button type="button" className="secondary-button" autoFocus={!confirmWord} onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="destructive-button" disabled={!ready || busy}>{busy ? "Deleting..." : confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
}
