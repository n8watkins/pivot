"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { replacements, type Replacement } from "@/components/pivot/data";
import { Logo, ReplacementIcon } from "@/components/pivot/ui";

export default function PivotEditor({ pivotId }: { pivotId?: string }) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [actions, setActions] = useState<Replacement[]>([]);
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(Boolean(pivotId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pivotId) return;
    void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { pivots?: { id: string; goal: string; replacements: Omit<Replacement, "icon">[] }[] } | null) => {
      const pivot = snapshot?.pivots?.find((item) => item.id === pivotId);
      if (!pivot) { setError("This pivot could not be found."); return; }
      setGoal(pivot.goal);
      setActions(pivot.replacements.map((item) => ({ ...item, icon: replacements.find((option) => option.id === item.id)?.icon ?? "custom" })));
    }).catch(() => setError("This pivot could not be loaded.")).finally(() => setLoading(false));
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
    setSaving(false);
    if (!response?.ok) { setError("Your pivot could not be saved. Please try again."); return; }
    router.push("/settings/pivots");
  }

  async function removePivot() {
    if (!pivotId || !window.confirm("Delete this pivot? Its past History entries will remain.")) return;
    setSaving(true);
    const response = await fetch(`/api/pivots/${pivotId}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) { setSaving(false); setError("Your pivot could not be deleted."); return; }
    router.push("/settings/pivots");
  }

  const available = replacements.filter((option) => !actions.some((item) => item.id === option.id));

  return <main className="app-shell"><div className="app-frame settings-page"><header className="site-header"><Link className="brand" href="/"><Logo /><span>pivot</span></Link><Link className="text-button" href="/settings/pivots">Cancel <span aria-hidden="true">×</span></Link></header><section className="settings-intro"><p className="eyebrow">{pivotId ? "Edit your pivot" : "A new direction"}</p><h1>{pivotId ? "Shape this pivot." : "Create a pivot."}</h1><p className="lede">Give this moment its own goal and its own practical alternatives.</p></section>{loading ? <div className="empty-state" role="status">Loading pivot...</div> : <><label className="field-label" htmlFor="pivot-name">Pivot name</label><input id="pivot-name" className="text-input" value={goal} placeholder="e.g. checking email after work" onChange={(event) => setGoal(event.target.value)} /><section className="editor-section"><div className="settings-section-heading"><div><span className="card-kicker">APPROVED ACTIONS</span><h2>What you can do instead</h2></div><span className="status-dot">{actions.length}</span></div>{actions.length ? <div className="action-editor-list">{actions.map((action, index) => <article className="action-editor" key={action.id}><span className="choice-icon"><ReplacementIcon name={action.icon} /></span><div><strong>{action.name}</strong><span>{action.duration}</span></div><div className="action-controls"><button aria-label={`Move ${action.name} up`} disabled={index === 0} onClick={() => moveAction(index, -1)}>↑</button><button aria-label={`Move ${action.name} down`} disabled={index === actions.length - 1} onClick={() => moveAction(index, 1)}>↓</button><button aria-label={`Remove ${action.name}`} onClick={() => setActions((current) => current.filter((item) => item.id !== action.id))}>×</button></div></article>)}</div> : <div className="empty-state">Add at least one action that feels realistic.</div>}</section>{available.length > 0 && <section className="editor-section"><p className="field-label">Add a suggested action</p><div className="choice-grid">{available.map((action) => <button className="choice" key={action.id} onClick={() => addAction(action)}><span className="choice-icon"><ReplacementIcon name={action.icon} /></span><span>{action.name}</span><span className="check">＋</span></button>)}</div></section>}<section className="editor-section"><label className="field-label" htmlFor="custom-action">Add your own action</label><div className="goal-add-row"><input id="custom-action" className="text-input" value={customName} placeholder="e.g. make tea and sit outside" onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomAction(); } }} /><button className="small-button" disabled={!customName.trim()} onClick={addCustomAction}>Add</button></div></section>{error && <p className="form-status" role="status">{error}</p>}<button className="primary-button full" disabled={!goal.trim() || !actions.length || saving} onClick={save}>{saving ? "Saving..." : "Save pivot"}<span>→</span></button>{pivotId && <button className="danger-button" disabled={saving} onClick={removePivot}>Delete this pivot</button>}</>}</div></main>;
}
