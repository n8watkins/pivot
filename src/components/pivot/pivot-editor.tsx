"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { replacements, type Replacement } from "@/components/pivot/data";
import { AppShell, type UtilityNavItem } from "@/components/pivot/app-shell";
import { Icon, ReplacementIcon } from "@/components/pivot/ui";
import { usePivotDataChanged, useUndoToast } from "@/components/pivot/undo-toast";

type SidebarPivot = { id: string; goal: string };

const utilityNav: UtilityNavItem[] = [
  { kind: "link", label: "Pause space", icon: "home", href: "/" },
  { kind: "link", label: "History", icon: "history", href: "/?screen=history" },
  { kind: "link", label: "Settings", icon: "settings", href: "/settings", active: true },
];

export default function PivotEditor({ pivotId }: { pivotId?: string }) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [actions, setActions] = useState<Replacement[]>([]);
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(Boolean(pivotId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sidebarPivots, setSidebarPivots] = useState<SidebarPivot[]>([]);
  const [pivotCounts, setPivotCounts] = useState<Record<string, number>>({});
  const { showDeleted } = useUndoToast();
  // After an Undo elsewhere only the sidebar refreshes, so the form keeps its edits.
  usePivotDataChanged(() => {
    void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { pivots?: SidebarPivot[] } | null) => {
      if (snapshot?.pivots) setSidebarPivots(snapshot.pivots.map((pivot) => ({ id: pivot.id, goal: pivot.goal })));
    }).catch(() => undefined);
  });

  useEffect(() => {
    void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { pivots?: { id: string; goal: string; replacements: Omit<Replacement, "icon">[] }[]; history?: { pivotId?: string }[] } | null) => {
      setSidebarPivots(snapshot?.pivots?.map((pivot) => ({ id: pivot.id, goal: pivot.goal })) ?? []);
      setPivotCounts((snapshot?.history ?? []).reduce<Record<string, number>>((acc, event) => { if (event.pivotId) acc[event.pivotId] = (acc[event.pivotId] ?? 0) + 1; return acc; }, {}));
      if (!pivotId) return;
      const pivot = snapshot?.pivots?.find((item) => item.id === pivotId);
      if (!pivot) { setError("This pivot could not be found."); return; }
      setGoal(pivot.goal);
      setActions(pivot.replacements.map((item) => ({ ...item, icon: replacements.find((option) => option.id === item.id)?.icon ?? "custom" })));
    }).catch(() => { if (pivotId) setError("This pivot could not be loaded."); }).finally(() => setLoading(false));
  }, [pivotId]);

  function addAction(action: Replacement) {
    if (actions.some((item) => item.id === action.id)) return;
    setActions((current) => [...current, action]);
  }

  function addCustomAction() {
    const name = customName.trim();
    if (!name) return;
    addAction({ id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name, detail: "A small action you chose for this moment.", duration: "5 min", icon: "custom" });
    setCustomName("");
  }

  function moveAction(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= actions.length) return;
    setActions((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  async function save() {
    if (!goal.trim() || !actions.length || saving) return;
    setSaving(true);
    setError("");
    const response = await fetch(pivotId ? `/api/pivots/${pivotId}` : "/api/pivots", { method: pivotId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal, replacements: actions }) }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setSaving(false);
    if (!response?.ok) { setError(payload?.error ?? "Your pivot could not be saved. Please try again."); return; }
    router.push("/settings/pivots");
  }

  async function removePivot() {
    if (!pivotId) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/pivots/${pivotId}`, { method: "DELETE" }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) { setSaving(false); setError(payload?.error ?? "Your pivot could not be deleted."); return; }
    // History keeps its entries either way; Undo brings the pivot back exactly as it was.
    showDeleted({ kind: "pivot", id: pivotId, message: `“${goal.trim() || "Pivot"}” deleted` });
    router.push("/settings/pivots");
  }

  const available = replacements.filter((option) => !actions.some((item) => item.id === option.id));

  return (
    <AppShell pivots={sidebarPivots} activePivotId={pivotId ?? null} pivotCounts={pivotCounts} utilityNav={utilityNav}>
      <div className="settings-page">
        <section className="settings-intro">
          <p className="eyebrow">{pivotId ? "Edit your pivot" : "A new direction"}</p>
          <h1>{pivotId ? "Shape this pivot." : "Create a pivot."}</h1>
          <p className="lede">Give this moment its own goal and its own practical alternatives.</p>
        </section>
        {loading ? <div className="empty-state" role="status">Loading pivot...</div> : (
          <div className="editor-body">
            <label className="field-label" htmlFor="pivot-name">Pivot name</label>
            <input id="pivot-name" className="text-input" value={goal} placeholder="e.g. checking email after work" onChange={(event) => setGoal(event.target.value)} />
            <section className="editor-section">
              <div className="settings-section-heading">
                <div><span className="card-kicker">Approved actions</span><h2>What you can do instead</h2></div>
                <span className="status-dot">{actions.length}</span>
              </div>
              {actions.length ? <div className="action-editor-list">{actions.map((action, index) => <article className="action-editor" key={action.id}><span className="choice-icon"><ReplacementIcon name={action.icon} /></span><div><strong>{action.name}</strong><span>{action.duration}</span></div><div className="action-controls"><button type="button" aria-label={`Move ${action.name} up`} disabled={index === 0} onClick={() => moveAction(index, -1)}><Icon name="chevronUp" size={16} /></button><button type="button" aria-label={`Move ${action.name} down`} disabled={index === actions.length - 1} onClick={() => moveAction(index, 1)}><Icon name="chevronDown" size={16} /></button><button type="button" aria-label={`Remove ${action.name}`} onClick={() => setActions((current) => current.filter((item) => item.id !== action.id))}><Icon name="close" size={16} /></button></div></article>)}</div> : <div className="empty-state">Add at least one action that feels realistic.</div>}
            </section>
            {available.length > 0 && <section className="editor-section"><p className="field-label">Add a suggested action</p><div className="choice-grid">{available.map((action) => <button type="button" className="choice" key={action.id} onClick={() => addAction(action)}><span className="choice-icon"><ReplacementIcon name={action.icon} /></span><span>{action.name}</span><span className="check"><Icon name="plus" size={15} /></span></button>)}</div></section>}
            <section className="editor-section">
              <label className="field-label" htmlFor="custom-action">Add your own action</label>
              <div className="goal-add-row"><input id="custom-action" className="text-input" value={customName} placeholder="e.g. make tea and sit outside" onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomAction(); } }} /><button type="button" className="small-button" disabled={!customName.trim()} onClick={addCustomAction}>Add</button></div>
            </section>
            {error && <p className="form-status" role="status">{error}</p>}
            <button type="button" className="primary-button full" disabled={!goal.trim() || !actions.length || saving} onClick={save}>{saving ? "Saving..." : "Save pivot"} <Icon name="arrowRight" size={18} /></button>
            {pivotId && <button type="button" className="danger-button" disabled={saving} onClick={removePivot}>Delete this pivot</button>}
            <Link className="quiet-button" href="/settings/pivots">Cancel</Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
