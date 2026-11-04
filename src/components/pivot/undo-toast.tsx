"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createUndoQueue, type UndoEntry, type UndoQueue, type UndoToast } from "@/lib/undo-queue";
import { Icon } from "@/components/pivot/ui";

// "Pivot deleted · Undo": reversible actions happen at once and this toast offers the way back.
// It lives in the root layout, so it survives the navigation that follows a delete.

export const PIVOT_DATA_CHANGED = "pivot:data-changed";

/** Tells every mounted view to reload /api/state, e.g. after an Undo brought a pivot back. */
export function announcePivotDataChanged() {
  window.dispatchEvent(new Event(PIVOT_DATA_CHANGED));
}

/** Runs `reload` whenever pivot data changed outside the current view. */
export function usePivotDataChanged(reload: () => void) {
  const latest = useRef(reload);
  useEffect(() => { latest.current = reload; });
  useEffect(() => {
    const listener = () => latest.current();
    window.addEventListener(PIVOT_DATA_CHANGED, listener);
    return () => window.removeEventListener(PIVOT_DATA_CHANGED, listener);
  }, []);
}

type TrashKind = "pivot" | "history" | "tag";

async function postTrash(action: "restore" | "finalize", kind: TrashKind, id: string, keepalive = false) {
  const response = await fetch("/api/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, kind, id }), keepalive });
  if (!response.ok) throw new Error(action === "restore" ? "restore_failed" : "finalize_failed");
}

type ShowUndo = (entry: Omit<UndoEntry, "id"> & { id?: string }) => void;
type ShowDeleted = (input: { kind: TrashKind; id: string; message: string; onRestored?: () => void }) => void;

const UndoContext = createContext<{ show: ShowUndo; showDeleted: ShowDeleted } | null>(null);

export function useUndoToast() {
  const value = useContext(UndoContext);
  if (!value) throw new Error("useUndoToast must be used inside UndoToastProvider");
  return value;
}

function isTextField(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
}

export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<UndoToast[]>([]);
  const [notice, setNotice] = useState("");
  const [queue] = useState<UndoQueue>(() => createUndoQueue({
    onChange: setToasts,
    onUndoError: () => setNotice("That can no longer be restored."),
  }));

  useEffect(() => {
    // A closed or backgrounded tab commits now, so nothing stays half-deleted; the hourly sweep
    // covers a tab that is killed before it can say so.
    const flush = () => queue.flush();
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [queue]);

  useEffect(() => {
    // Ctrl/Cmd+Z undoes the newest toast while one shows, unless the user is editing text.
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key.toLowerCase() !== "z") return;
      if (!queue.size || isTextField(event.target)) return;
      event.preventDefault();
      void queue.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue]);

  // The pointer or focus that paused the countdown leaves with the last toast.
  useEffect(() => { if (!toasts.length) queue.resume(); }, [toasts, queue]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5_000);
    return () => clearTimeout(timer);
  }, [notice]);

  const show = useCallback<ShowUndo>((entry) => {
    setNotice("");
    queue.push({ ...entry, id: entry.id ?? crypto.randomUUID() });
  }, [queue]);

  const showDeleted = useCallback<ShowDeleted>(({ kind, id, message, onRestored }) => {
    show({
      id: `${kind}:${id}`,
      message,
      undo: async () => {
        await postTrash("restore", kind, id);
        onRestored?.();
        announcePivotDataChanged();
      },
      // keepalive lets the request finish when the commit comes from a closing tab.
      commit: () => postTrash("finalize", kind, id, true).catch(() => undefined),
    });
  }, [show]);

  const value = useMemo(() => ({ show, showDeleted }), [show, showDeleted]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications" onPointerEnter={() => queue.pause()} onPointerLeave={() => queue.resume()} onFocus={() => queue.pause()} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) queue.resume(); }}>
        {/* A polite live region (no status role, so it never competes with a page's own status line). */}
        <div className="toast-stack" aria-live="polite" aria-relevant="additions text">
          {toasts.map((toast) => (
            <div className="toast" key={toast.id}>
              <span className="toast-message">{toast.message}</span>
              <button type="button" className="toast-undo" onClick={() => void queue.undo(toast.id)}>Undo</button>
              <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => queue.dismiss(toast.id)}><Icon name="close" size={16} /></button>
            </div>
          ))}
          {notice && <div className="toast toast-notice"><span className="toast-message">{notice}</span></div>}
        </div>
      </div>
    </UndoContext.Provider>
  );
}
