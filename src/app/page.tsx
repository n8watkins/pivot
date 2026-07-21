"use client";

import { useMemo, useState } from "react";

type Screen = "setup" | "home" | "urge" | "recommendation" | "active" | "followup" | "history" | "safety";
type Replacement = { id: string; name: string; detail: string; duration: string; icon: string };

const replacements: Replacement[] = [
  { id: "walk", name: "Take a short walk", detail: "A quick reset for your body and attention.", duration: "5 min", icon: "↗" },
  { id: "breathe", name: "Slow breathing", detail: "Create a little room between you and the urge.", duration: "2 min", icon: "◌" },
  { id: "stretch", name: "Stretch your shoulders", detail: "Release some tension without leaving your space.", duration: "3 min", icon: "⌁" },
  { id: "water", name: "Make a glass of water", detail: "A small, physical action to change the moment.", duration: "3 min", icon: "◒" },
  { id: "friend", name: "Message someone", detail: "A low-pressure way to reconnect with a person.", duration: "5 min", icon: "✦" },
];

function Logo() { return <div className="logo-mark" aria-hidden="true">✳</div>; }

function Header({ onHistory, onReset }: { onHistory: () => void; onReset: () => void }) {
  return <header className="site-header"><a className="brand" href="#" onClick={(event) => { event.preventDefault(); onReset(); }}><Logo /><span>pivot</span></a><button className="text-button" onClick={onHistory}>History <span aria-hidden="true">↗</span></button></header>;
}

function Progress({ step, total = 3 }: { step: number; total?: number }) {
  return <div className="progress" aria-label={`Step ${step} of ${total}`}><span>{step}</span><div className="progress-track"><i style={{ width: `${(step / total) * 100}%` }} /></div><span>{total}</span></div>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>(() => typeof window !== "undefined" && localStorage.getItem("pivot-state") ? "home" : "setup");
  const [goal, setGoal] = useState(() => { if (typeof window === "undefined") return ""; try { return JSON.parse(localStorage.getItem("pivot-state") ?? "{}").goal ?? ""; } catch { return ""; } });
  const [selected, setSelected] = useState<string[]>(() => { if (typeof window === "undefined") return ["walk", "breathe", "stretch"]; try { return JSON.parse(localStorage.getItem("pivot-state") ?? "{}").selected ?? ["walk", "breathe", "stretch"]; } catch { return ["walk", "breathe", "stretch"]; } });
  const [urge, setUrge] = useState(7);
  const [context, setContext] = useState("");
  const [started, setStarted] = useState(false);
  const [modelPrimaryId, setModelPrimaryId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ date: string; choice: string; outcome: string }[]>(() => { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem("pivot-state") ?? "{}").history ?? []; } catch { return []; } });

  const approved = useMemo(() => replacements.filter((item) => selected.includes(item.id)), [selected]);
  const primary = approved.find((item) => item.id === modelPrimaryId) ?? approved[0] ?? replacements[0];
  const alternative = approved.slice(1, 3);

  function save() { localStorage.setItem("pivot-state", JSON.stringify({ goal, selected, history })); }
  function finishSetup() { if (!goal.trim() || selected.length < 3) return; save(); setScreen("home"); }
  async function requestRecommendation() {
    const response = await fetch("/api/recommendation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replacements: approved, context }) }).catch(() => null);
    const result = response?.ok ? await response.json().catch(() => null) : null;
    if (result?.route === "support") { setScreen("safety"); return; }
    if (result?.replacementId) setModelPrimaryId(result.replacementId);
    setScreen("recommendation");
  }
  function complete(outcome: string) { const next = [{ date: "Today", choice: primary.name, outcome }, ...history]; setHistory(next); localStorage.setItem("pivot-state", JSON.stringify({ goal, selected, history: next })); setScreen("home"); setStarted(false); }
  function reset() { setScreen(goal ? "home" : "setup"); }

  if (screen === "setup") return <main className="app-shell"><div className="setup-wrap"><div className="setup-top"><a className="brand" href="#"><Logo /><span>pivot</span></a><span className="quiet">Private by design</span></div><Progress step={1} /><div className="setup-copy"><p className="eyebrow">A small change, right now</p><h1>What would you like to pivot away from?</h1><p className="lede">Choose one digital habit you want a little more space from. This stays yours.</p></div><label className="field-label" htmlFor="goal">My goal is to stop</label><input autoFocus id="goal" className="text-input" placeholder="e.g. scrolling late at night" value={goal} onChange={(e) => setGoal(e.target.value)} /><div className="setup-section"><p className="field-label">When an urge arrives, I’m open to</p><div className="choice-grid">{replacements.map((item) => <button key={item.id} className={`choice ${selected.includes(item.id) ? "selected" : ""}`} onClick={() => setSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}><span className="choice-icon">{item.icon}</span><span>{item.name}</span><span className="check">{selected.includes(item.id) ? "✓" : ""}</span></button>)}</div><p className="hint">Pick 3 to 5 options that feel realistic for you.</p></div><button className="primary-button full" disabled={!goal.trim() || selected.length < 3} onClick={finishSetup}>Continue <span>→</span></button><p className="privacy-note"><span>⊙</span> No account needed. Your choices stay on this device.</p></div></main>;

  return <main className="app-shell"><div className="app-frame"><Header onHistory={() => setScreen("history")} onReset={reset} />
    {screen === "home" && <section className="home-screen"><div className="home-intro"><p className="eyebrow">Your pause space</p><h1>Ready when you are.</h1><p className="lede">One moment at a time. No judgment, no streaks.</p></div><button className="urge-button" onClick={() => setScreen("urge")}><span className="urge-symbol">✳</span><span><strong>I’m having an urge</strong><small>Let’s find a next step</small></span><span className="arrow">→</span></button><div className="today-card"><div><span className="card-kicker">YOUR PIVOT</span><h2>{goal}</h2></div><button className="icon-button" aria-label="Edit goal" onClick={() => setScreen("setup")}>✎</button></div><div className="evidence"><span className="evidence-icon">✦</span><div><strong>{history.length ? `${history.length} moment${history.length === 1 ? "" : "s"} redirected` : "Your first pivot starts here"}</strong><p>{history.length ? "Small actions add up." : "There’s no perfect way to begin."}</p></div></div></section>}
    {screen === "urge" && <section className="flow-screen"><Progress step={1} total={3} /><p className="eyebrow">Right now</p><h1>What’s this moment like?</h1><p className="lede">A little context helps me find a better fit. You can skip this.</p><div className="chip-row">{["Bored", "Stressed", "Tired", "Avoiding something", "Just automatic"].map((item) => <button className={`chip ${context === item ? "active" : ""}`} key={item} onClick={() => setContext(context === item ? "" : item)}>{item}</button>)}</div><label className="field-label" htmlFor="context">Anything else on your mind? <span>Optional</span></label><textarea id="context" className="text-input text-area" placeholder="A few words, if useful" value={context.includes("|") ? context.split("|")[1] : ""} onChange={(e) => setContext(e.target.value ? `note|${e.target.value}` : "")} /><div className="intensity"><div><span className="field-label">How strong is it?</span><strong>{urge} / 10</strong></div><input type="range" min="1" max="10" value={urge} onChange={(e) => setUrge(Number(e.target.value))} aria-label="Urge intensity" /></div><button className="primary-button full" onClick={requestRecommendation}>Show me a next step <span>→</span></button><button className="quiet-button" onClick={requestRecommendation}>Skip and show me something</button></section>}
    {screen === "recommendation" && <section className="flow-screen"><Progress step={2} total={3} /><p className="eyebrow">A gentle pivot</p><h1>Try this for {primary.duration}.</h1><p className="lede">Based on what you’ve shared, this is a simple place to start.</p><article className="recommend-card"><div className="recommend-icon">{primary.icon}</div><div><span className="card-kicker">YOUR RECOMMENDATION</span><h2>{primary.name}</h2><p>{primary.detail}</p><div className="reason">✦ Fits a {context && !context.includes("|") ? context.toLowerCase() : "busy"} moment</div></div></article><button className="primary-button full" onClick={() => { setStarted(true); setScreen("active"); }}>Start this action <span>→</span></button>{alternative.length > 0 && <div className="alternatives"><p className="field-label">Or choose another</p>{alternative.map((item) => <button key={item.id} className="alternative" onClick={() => { setStarted(true); setScreen("active"); }}><span>{item.icon}</span><span><strong>{item.name}</strong><small>{item.duration}</small></span><b>→</b></button>)}</div>}<button className="quiet-button" onClick={() => setScreen("urge")}>Not quite - adjust context</button></section>}
    {screen === "active" && <section className="active-screen"><div className="active-orbit"><div className="orbit-inner"><span>✳</span><strong>{primary.duration}</strong><small>for you</small></div></div><p className="eyebrow">You’re in it</p><h1>{primary.name}</h1><p className="lede">Start with one small step. The urge can be here while you do it.</p><div className="first-step"><span className="step-number">1</span><div><span className="card-kicker">FIRST STEP</span><p>{primary.id === "walk" ? "Put on your shoes and step outside." : primary.id === "breathe" ? "Drop your shoulders. Breathe in for 4, out for 6." : `Begin with 30 seconds of ${primary.name.toLowerCase()}.`}</p></div></div><button className="primary-button full" onClick={() => setScreen("followup")}>I’m done for now <span>→</span></button><button className="quiet-button" onClick={() => setScreen("followup")}>I stopped early</button></section>}
    {screen === "followup" && <section className="flow-screen"><Progress step={3} total={3} /><p className="eyebrow">A quick check-in</p><h1>How are you feeling now?</h1><p className="lede">There’s no right answer. This just helps Pivot learn what supports you.</p><div className="rating-grid">{["Much lighter", "A little lighter", "About the same", "Stronger"].map((item, index) => <button key={item} className="rating" onClick={() => complete(item)}><span>{["☼", "◒", "○", "△"][index]}</span>{item}</button>)}</div><button className="quiet-button" onClick={() => complete("Skipped")}>Skip check-in</button></section>}
    {screen === "history" && <section className="history-screen"><p className="eyebrow">Your evidence</p><h1>Small moments count.</h1><p className="lede">A quiet record of the times you chose a different next step.</p><div className="history-stat"><strong>{history.length}</strong><span>redirected {history.length === 1 ? "moment" : "moments"}</span></div>{history.length ? <div className="history-list">{history.map((item, index) => <article key={`${item.date}-${index}`}><span className="history-dot">✦</span><div><strong>{item.choice}</strong><p>{item.outcome} · {item.date}</p></div></article>)}</div> : <div className="empty-state">Your first entry will appear here after a pivot.</div>}<button className="primary-button full" onClick={() => setScreen("home")}>Back to pause space</button><button className="danger-button" onClick={() => { localStorage.removeItem("pivot-state"); setGoal(""); setSelected(["walk", "breathe", "stretch"]); setHistory([]); setScreen("setup"); }}>Delete my local data</button></section>}
    {screen === "safety" && <section className="flow-screen"><p className="eyebrow">A different kind of support</p><h1>This may need more than a pivot.</h1><p className="lede">Pivot is for everyday digital habits. If you feel unsafe or at risk of harming yourself or someone else, please contact local emergency services or a trusted person now.</p><button className="primary-button full" onClick={() => setScreen("home")}>Return to Pivot</button></section>}
    {started && screen !== "active" && null}
  </div></main>;
}
