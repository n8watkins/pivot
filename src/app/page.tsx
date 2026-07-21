"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header, Progress, ReplacementIcon } from "@/components/pivot/ui";
import { replacements, type Replacement } from "@/components/pivot/data";

type Screen = "home" | "urge" | "recommendation" | "active" | "followup" | "history" | "safety";
type RecommendationResult = { replacementId: string; reason: string; firstStep: string; alternatives: string[]; source: "gemini" | "fallback" };

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [goal, setGoal] = useState(() => { if (typeof window === "undefined") return ""; try { const saved = JSON.parse(localStorage.getItem("pivot-state") ?? "{}"); return saved.goals?.[0] ?? saved.goal ?? ""; } catch { return ""; } });
  const [selected, setSelected] = useState<string[]>(() => { if (typeof window === "undefined") return ["walk", "breathe", "stretch"]; try { return JSON.parse(localStorage.getItem("pivot-state") ?? "{}").selected ?? ["walk", "breathe", "stretch"]; } catch { return ["walk", "breathe", "stretch"]; } });
  const [customReplacements, setCustomReplacements] = useState<Replacement[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem("pivot-state") ?? "{}").customReplacements ?? []; } catch { return []; } });
  const [pivots, setPivots] = useState<{ id: string; goal: string; replacements: Replacement[] }[]>([]);
  const [activePivotId, setActivePivotId] = useState<string | null>(null);
  const [stateReady, setStateReady] = useState(false);
  const [urge, setUrge] = useState(7);
  const [context, setContext] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [customContexts, setCustomContexts] = useState<string[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem("pivot-state") ?? "{}").customContexts ?? []; } catch { return []; } });
  const [started, setStarted] = useState(false);
  const [modelPrimaryId, setModelPrimaryId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [recommendationSource, setRecommendationSource] = useState<"gemini" | "fallback">("fallback");
  const [isRecommending, setIsRecommending] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [history, setHistory] = useState<{ date: string; choice: string; outcome: string }[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem("pivot-state") ?? "{}").history ?? []; } catch { return []; } });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { goal?: string; goals?: string[]; replacements?: { id: string; name: string; detail: string; duration: string }[]; pivots?: { id: string; goal: string; replacements: { id: string; name: string; detail: string; duration: string }[] }[]; contextTags?: string[]; history?: { choice: string; outcome: string; helpful: boolean; date: string }[]; active?: { replacementId: string } } | null) => {
      if (cancelled || !snapshot?.goal) return;
      const replacementIds = snapshot.replacements?.map((item) => item.id) ?? [];
      const serverCustom = snapshot.replacements?.filter((item) => !replacements.some((option) => option.id === item.id)).map((item) => ({ ...item, icon: "custom" })) ?? [];
      setGoal(snapshot.goals?.[0] ?? snapshot.goal ?? "");
      setCustomReplacements(serverCustom);
      const serverPivots = snapshot.pivots?.map((pivot) => ({ ...pivot, replacements: pivot.replacements.map((item) => ({ ...item, icon: replacements.find((option) => option.id === item.id)?.icon ?? "custom" })) })) ?? [];
      setPivots(serverPivots);
      setActivePivotId(serverPivots[0]?.id ?? null);
      if (serverPivots[0]) setSelected(serverPivots[0].replacements.map((item) => item.id));
      else if (replacementIds.length) setSelected(replacementIds);
      setHistory(snapshot.history ?? []);
      setCustomContexts(snapshot.contextTags ?? []);
      if (snapshot.active?.replacementId) { setModelPrimaryId(snapshot.active.replacementId); setStarted(true); setScreen("active"); }
    }).catch(() => undefined).finally(() => { if (!cancelled) setStateReady(true); });
    return () => { cancelled = true; };
  }, []);

  const activePivot = pivots.find((pivot) => pivot.id === activePivotId);
  const availableReplacements = useMemo(() => activePivot?.replacements ?? [...replacements, ...customReplacements], [activePivot, customReplacements]);
  const approved = useMemo(() => activePivot?.replacements ?? availableReplacements.filter((item) => selected.includes(item.id)), [activePivot, availableReplacements, selected]);
  const primary = approved.find((item) => item.id === (recommendation?.replacementId ?? modelPrimaryId)) ?? approved[0] ?? replacements[0];
  const alternative = recommendation ? recommendation.alternatives.map((id) => approved.find((item) => item.id === id)).filter((item): item is Replacement => Boolean(item)) : approved.slice(1, 3);
  const firstStep = recommendation?.replacementId === primary.id ? recommendation.firstStep : primary.id === "walk" ? "Put on your shoes and step outside." : primary.id === "breathe" ? "Drop your shoulders. Breathe in for 4, out for 6." : `Begin with 30 seconds of ${primary.name.toLowerCase()}.`;

  async function requestRecommendation() {
    if (!approved.length || isRecommending) return;
    setIsRecommending(true);
    setFlowError("");
    setRecommendationSource("fallback");
    const fallback: RecommendationResult = { replacementId: approved[0].id, reason: "It is an approved option that can change the shape of this moment.", firstStep: `Begin with 30 seconds of ${approved[0].name.toLowerCase()}.`, alternatives: approved.slice(1, 3).map((item) => item.id), source: "fallback" };
    const response = await fetch("/api/recommendation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replacements: approved, context, pivotId: activePivotId ?? undefined }) }).catch(() => null);
    const result = response?.ok ? await response.json().catch(() => null) : null;
    setIsRecommending(false);
    if (result?.route === "support") { setScreen("safety"); return; }
    const next = result?.replacementId ? result as RecommendationResult : fallback;
    if (!result?.replacementId) setFlowError("Pivot could not reach the recommendation service, so it chose a safe approved action locally.");
    setRecommendation(next);
    setModelPrimaryId(next.replacementId);
    setRecommendationSource(next.source === "gemini" ? "gemini" : "fallback");
    setScreen("recommendation");
  }
  async function startAction(item: Replacement) {
    if (isStarting) return;
    setIsStarting(true);
    setFlowError("");
    const response = await fetch("/api/intervention", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replacementId: item.id }) }).catch(() => null);
    if (!response?.ok) setFlowError("This action could not be saved for refresh recovery, but you can still continue with it.");
    setModelPrimaryId(item.id);
    setStarted(true);
    setIsStarting(false);
    setScreen("active");
  }
  function complete(outcome: string) { const next = [{ date: new Date().toISOString(), choice: primary.name, outcome }, ...history]; setHistory(next); localStorage.setItem("pivot-state", JSON.stringify({ goal, selected, customReplacements, pivots, activePivotId, customContexts, history: next })); void fetch("/api/closed-loop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replacementId: primary.id, intensity: urge, contextType: context, reason: primary.detail, firstStep: `Begin with 30 seconds of ${primary.name.toLowerCase()}.`, source: recommendationSource, outcome, helpful: outcome.includes("lighter") }) }); setScreen("home"); setStarted(false); }
  function reset() { setScreen("home"); }
  function addContextTag() { const tag = customContext.trim(); if (!tag || customContexts.some((item) => item.toLowerCase() === tag.toLowerCase())) return; const next = [...customContexts, tag]; setCustomContexts(next); setContext(tag); setCustomContext(""); localStorage.setItem("pivot-state", JSON.stringify({ goal, selected, customReplacements, pivots, activePivotId, customContexts: next, history })); void fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: tag }) }); }
  function choosePivot(id: string) { const pivot = pivots.find((item) => item.id === id); setActivePivotId(id); setSelected(pivot?.replacements.map((item) => item.id) ?? []); setModelPrimaryId(null); setRecommendation(null); setFlowError(""); localStorage.setItem("pivot-state", JSON.stringify({ goal, selected: pivot?.replacements.map((item) => item.id) ?? [], customReplacements, pivots, activePivotId: id, customContexts, history })); }
  function formatHistoryDate(value: string) { if (value === "Today") return value; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Recently" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date); }

  return <main className="app-shell"><div className="app-frame"><Header onHistory={() => setScreen("history")} onReset={reset} />
    {screen === "home" && <section className="home-screen"><div className="home-intro"><p className="eyebrow">Your pause space</p><h1>Ready when you are.</h1><p className="lede">One moment at a time. No judgment, no streaks.</p></div><button className="urge-button" disabled={!activePivot || !stateReady} onClick={() => setScreen("urge")}><span className="urge-symbol">✳</span><span><strong>{activePivot ? "I’m having an urge" : stateReady ? "Create a pivot first" : "Loading your pivots"}</strong><small>{activePivot ? "Let’s find a next step" : stateReady ? "Choose what you want to change" : "Just a moment"}</small></span><span className="arrow">→</span></button><div className="today-card"><div><span className="card-kicker">CURRENT PIVOT</span>{activePivot ? <><h2>{activePivot.goal}</h2>{pivots.length > 1 && <div className="pivot-switcher" aria-label="Choose a pivot">{pivots.map((pivot) => <button disabled={!stateReady} className={pivot.id === activePivotId ? "active" : ""} key={pivot.id} onClick={() => choosePivot(pivot.id)}>{pivot.goal}</button>)}</div>}</> : stateReady ? <Link className="onboarding-link" href="/onboarding">Set up your first pivot →</Link> : <span className="settings-copy">Loading...</span>}</div><Link className="icon-button" aria-label="Edit pivots" href="/onboarding">✎</Link></div><div className="evidence"><span className="evidence-icon">✦</span><div><strong>{history.length ? `${history.length} moment${history.length === 1 ? "" : "s"} redirected` : "Your first pivot starts here"}</strong><p>{history.length ? "Small actions add up." : "There’s no perfect way to begin."}</p></div></div></section>}
    {screen === "urge" && <section className="flow-screen"><Progress step={1} total={3} /><p className="eyebrow">Right now</p><h1>What’s this moment like?</h1><p className="lede">A little context helps me find a better fit. You can skip this.</p><div className="chip-row">{["Bored", "Stressed", "Tired", "Avoiding something", "Just automatic", ...customContexts].map((item) => <button className={`chip ${context === item ? "active" : ""}`} key={item} onClick={() => setContext(context === item ? "" : item)}>{item}</button>)}</div><label className="field-label" htmlFor="custom-context">Add your own tag <span>Optional</span></label><div className="goal-add-row context-add-row"><input id="custom-context" className="text-input" placeholder="e.g. restless, lonely, procrastinating" value={customContext} onChange={(e) => setCustomContext(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addContextTag(); } }} /><button className="small-button" onClick={addContextTag} disabled={!customContext.trim()}>Add</button></div><label className="field-label" htmlFor="context">Anything else on your mind? <span>Optional</span></label><textarea id="context" className="text-input text-area" placeholder="A few words, if useful" value={context.includes("|") ? context.split("|")[1] : ""} onChange={(e) => setContext(e.target.value ? `note|${e.target.value}` : "")} /><div className="intensity"><div><span className="field-label">How strong is it?</span><strong>{urge} / 10</strong></div><input type="range" min="1" max="10" value={urge} onChange={(e) => setUrge(Number(e.target.value))} aria-label="Urge intensity" /></div>{flowError && <p className="form-status" role="status">{flowError}</p>}<button className="primary-button full" disabled={isRecommending} onClick={requestRecommendation}>{isRecommending ? "Finding a next step..." : "Show me a next step"} <span>→</span></button><button className="quiet-button" disabled={isRecommending} onClick={requestRecommendation}>Skip and show me something</button></section>}
    {screen === "recommendation" && <section className="flow-screen"><Progress step={2} total={3} /><p className="eyebrow">A gentle pivot</p><h1>Try this for {primary.duration}.</h1><p className="lede">Based on what you’ve shared, this is a simple place to start.</p>{flowError && <p className="form-status" role="status">{flowError}</p>}<article className="recommend-card"><div className="recommend-icon"><ReplacementIcon name={primary.icon} /></div><div><span className="card-kicker">YOUR RECOMMENDATION</span><h2>{primary.name}</h2><p>{primary.detail}</p><div className="reason">✦ {recommendation?.reason ?? primary.detail}</div></div></article><button className="primary-button full" disabled={isStarting} onClick={() => startAction(primary)}>{isStarting ? "Saving action..." : "Start this action"} <span>→</span></button>{alternative.length > 0 && <div className="alternatives"><p className="field-label">Or choose another</p>{alternative.map((item) => <button disabled={isStarting} key={item.id} className="alternative" onClick={() => startAction(item)}><span><ReplacementIcon name={item.icon} /></span><span><strong>{item.name}</strong><small>{item.duration}</small></span><b>→</b></button>)}</div>}<button className="quiet-button" disabled={isStarting} onClick={() => setScreen("urge")}>Not quite - adjust context</button></section>}
    {screen === "active" && <section className="active-screen"><div className="active-orbit"><div className="orbit-inner"><span>✳</span><strong>{primary.duration}</strong><small>for you</small></div></div><p className="eyebrow">You’re in it</p><h1>{primary.name}</h1><p className="lede">Start with one small step. The urge can be here while you do it.</p>{flowError && <p className="form-status" role="status">{flowError}</p>}<div className="first-step"><span className="step-number">1</span><div><span className="card-kicker">FIRST STEP</span><p>{firstStep}</p></div></div><button className="primary-button full" onClick={() => setScreen("followup")}>I’m done for now <span>→</span></button><button className="quiet-button" onClick={() => setScreen("followup")}>I stopped early</button></section>}
    {screen === "followup" && <section className="flow-screen"><Progress step={3} total={3} /><p className="eyebrow">A quick check-in</p><h1>How are you feeling now?</h1><p className="lede">There’s no right answer. This just helps Pivot learn what supports you.</p><div className="rating-grid">{["Much lighter", "A little lighter", "About the same", "Stronger"].map((item, index) => <button key={item} className="rating" onClick={() => complete(item)}><span>{["☼", "◒", "○", "△"][index]}</span>{item}</button>)}</div><button className="quiet-button" onClick={() => complete("Skipped")}>Skip check-in</button></section>}
    {screen === "history" && <section className="history-screen"><p className="eyebrow">Your evidence</p><h1>Small moments count.</h1><p className="lede">A quiet record of the times you chose a different next step.</p><div className="history-stat"><strong>{history.length}</strong><span>redirected {history.length === 1 ? "moment" : "moments"}</span></div>{history.length ? <div className="history-list">{history.map((item, index) => <article key={`${item.date}-${index}`}><span className="history-dot">✦</span><div><strong>{item.choice}</strong><p>{item.outcome} · {formatHistoryDate(item.date)}</p></div></article>)}</div> : <div className="empty-state">Your first entry will appear here after a pivot.</div>}<button className="primary-button full" onClick={() => setScreen("home")}>Back to pause space</button><button className="danger-button" onClick={() => { void fetch("/api/session", { method: "DELETE" }); localStorage.removeItem("pivot-state"); window.location.href = "/onboarding"; }}>Delete my local data</button></section>}
    {screen === "safety" && <section className="flow-screen"><p className="eyebrow">A different kind of support</p><h1>This may need more than a pivot.</h1><p className="lede">Pivot is for everyday digital habits. If you feel unsafe or at risk of harming yourself or someone else, please contact local emergency services or a trusted person now.</p><button className="primary-button full" onClick={() => setScreen("home")}>Return to Pivot</button></section>}
    {started && screen !== "active" && null}
  </div></main>;
}
