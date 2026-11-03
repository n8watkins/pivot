"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SafetyFooter } from "@/components/pivot/legal-page";
import { Icon, Logo, Progress, ReplacementChoice } from "@/components/pivot/ui";
import { replacements, type Replacement } from "@/components/pivot/data";

type Pivot = { id: string; goal: string; replacements: Replacement[] };

export default function Onboarding() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [selected, setSelected] = useState<string[]>(["walk", "breathe", "stretch"]);
  const [customReplacements, setCustomReplacements] = useState<Replacement[]>([]);
  const [customName, setCustomName] = useState("");
  const availableReplacements = useMemo(() => [...replacements, ...customReplacements], [customReplacements]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { pivots?: { id: string; goal: string; replacements: Omit<Replacement, "icon">[] }[] } | null) => {
      if (cancelled || !snapshot?.pivots?.length) return;
      const restored = snapshot.pivots.filter((pivot) => pivot.replacements.length > 0).map((pivot) => ({ ...pivot, replacements: pivot.replacements.map((item) => ({ ...item, icon: replacements.find((option) => option.id === item.id)?.icon ?? "custom" })) }));
      setPivots(restored);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  function addCustomReplacement() {
    const name = customName.trim();
    if (!name) return;
    const custom = { id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, name, detail: "A small action you chose for this moment.", duration: "5 min", icon: "custom" };
    setCustomReplacements((current) => [...current, custom]);
    setSelected((current) => [...current, custom.id]);
    setCustomName("");
  }

  function savePivot() {
    const label = goal.trim();
    if (!label || !selected.length) return;
    const pivot = { id: `pivot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, goal: label, replacements: availableReplacements.filter((item) => selected.includes(item.id)) };
    setPivots((current) => [...current, pivot]);
    setGoal("");
    setSelected(["walk", "breathe", "stretch"]);
    setCustomReplacements([]);
  }

  async function finishSetup() {
    if (!pivots.length) return;
    const response = await fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pivots }) }).catch(() => null);
    if (!response?.ok) return;
    localStorage.setItem("pivot-state", JSON.stringify({ goal: pivots[0].goal, goals: pivots.map((pivot) => pivot.goal), pivots, selected: pivots[0].replacements.map((item) => item.id), history: [] }));
    router.push("/");
  }

  return (
    <main className="app-shell">
      <div className="setup-wrap">
        <div className="setup-top">
          <Link className="brand" href="/"><Logo /><span>pivot</span></Link>
          <span className="quiet">Private by design</span>
        </div>
        <Progress step={1} label="Setup progress" />
        <div className="setup-copy">
          <p className="eyebrow">Make space for a different next step</p>
          <h1>What would you like to pivot away from?</h1>
          <p className="lede">Create one pivot at a time. Each one can have its own set of actions that fit.</p>
        </div>
        <label className="field-label" htmlFor="goal">Name this pivot</label>
        <div className="goal-add-row"><input autoFocus id="goal" className="text-input" placeholder="e.g. late night scrolling" value={goal} onChange={(event) => setGoal(event.target.value)} /></div>
        <div className="setup-section">
          <p className="field-label">For this pivot, I’m open to</p>
          <div className="choice-grid">{availableReplacements.map((item) => <ReplacementChoice key={item.id} item={item} selected={selected.includes(item.id)} onToggle={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />)}</div>
          <div className="custom-replacement">
            <label className="field-label" htmlFor="custom-replacement">Add your own action <span>Optional</span></label>
            <div className="goal-add-row"><input id="custom-replacement" className="text-input" placeholder="e.g. sketch for five minutes" value={customName} onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomReplacement(); } }} /><button type="button" className="small-button" onClick={addCustomReplacement} disabled={!customName.trim()}>Add</button></div>
          </div>
          <p className="hint">Add as many actions as you want. They stay specific to this pivot.</p>
        </div>
        <button type="button" className="secondary-button full" disabled={!goal.trim() || !selected.length} onClick={savePivot}>{pivots.length ? "Save this pivot" : "Save pivot"} <Icon name="plus" size={17} /></button>
        {pivots.length > 0 && <div className="pivot-list" aria-label="Your pivots"><p className="field-label">Your pivots</p>{pivots.map((pivot) => <article className="pivot-summary" key={pivot.id}><div><strong>{pivot.goal}</strong><span>{pivot.replacements.length} action{pivot.replacements.length === 1 ? "" : "s"} ready</span></div><button type="button" aria-label={`Remove ${pivot.goal}`} onClick={() => setPivots((current) => current.filter((item) => item.id !== pivot.id))}><Icon name="close" size={17} /></button></article>)}</div>}
        <button type="button" className="primary-button full" disabled={!pivots.length} onClick={finishSetup}>Finish setup <Icon name="arrowRight" size={18} /></button>
        <p className="privacy-note"><span className="privacy-ic"><Icon name="shield" size={15} /></span> No account needed. You can connect GitHub later for cross-device access.</p>
        <SafetyFooter />
      </div>
    </main>
  );
}
