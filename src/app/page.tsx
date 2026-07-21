"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { replacements, type Replacement } from "@/components/pivot/data";
import { Header, Progress, ReplacementIcon } from "@/components/pivot/ui";

type Screen = "home" | "urge" | "recommendation" | "active" | "followup" | "history" | "safety";
type Pivot = { id: string; goal: string; replacements: Replacement[] };
type HistoryEvent = { id?: string; pivotId?: string; pivotGoal?: string; date: string; choice: string; outcome: string };
type RecommendationResult = { replacementId: string; reason: string; firstStep: string; alternatives: string[]; source: "gemini" | "fallback" };

function durationInSeconds(duration: string) {
  const match = duration.match(/(\d+(?:\.\d+)?)\s*(min|minute|sec|second)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  return Math.max(1, Math.round(amount * (match[2].toLowerCase().startsWith("m") ? 60 : 1)));
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [goal, setGoal] = useState("");
  const [selected, setSelected] = useState<string[]>(["walk", "breathe", "stretch"]);
  const [customReplacements, setCustomReplacements] = useState<Replacement[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [activePivotId, setActivePivotId] = useState<string | null>(null);
  const [stateReady, setStateReady] = useState(false);
  const [urge, setUrge] = useState(7);
  const [context, setContext] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [customContexts, setCustomContexts] = useState<string[]>([]);
  const [modelPrimaryId, setModelPrimaryId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [recommendationSource, setRecommendationSource] = useState<"gemini" | "fallback">("fallback");
  const [activeStartedAt, setActiveStartedAt] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [followupOutcome, setFollowupOutcome] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [isRecommending, setIsRecommending] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [safetyKind, setSafetyKind] = useState<"high-risk" | "specialized">("high-risk");
  const [history, setHistory] = useState<HistoryEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/state")
      .then((response) => response.ok ? response.json() : null)
      .then((snapshot: { goal?: string; goals?: string[]; replacements?: Omit<Replacement, "icon">[]; pivots?: { id: string; goal: string; replacements: Omit<Replacement, "icon">[] }[]; contextTags?: string[]; history?: HistoryEvent[]; active?: { pivotId?: string; replacementId: string; reason?: string; firstStep?: string; source?: "gemini" | "fallback"; startedAt: string } } | null) => {
        if (cancelled || !snapshot) return;
        const serverPivots = snapshot.pivots?.map((pivot) => ({
          ...pivot,
          replacements: pivot.replacements.map((item) => ({ ...item, icon: replacements.find((option) => option.id === item.id)?.icon ?? "custom" })),
        })) ?? [];
        const replacementIds = snapshot.replacements?.map((item) => item.id) ?? [];
        const serverCustom = snapshot.replacements?.filter((item) => !replacements.some((option) => option.id === item.id)).map((item) => ({ ...item, icon: "custom" })) ?? [];
        const recoveredPivotId = snapshot.active?.pivotId || serverPivots.find((pivot) => pivot.replacements.some((item) => item.id === snapshot.active?.replacementId))?.id;

        setGoal(snapshot.goals?.[0] ?? snapshot.goal ?? "");
        setCustomReplacements(serverCustom);
        setPivots(serverPivots);
        setActivePivotId(recoveredPivotId ?? serverPivots[0]?.id ?? null);
        if (serverPivots[0]) setSelected((serverPivots.find((pivot) => pivot.id === recoveredPivotId) ?? serverPivots[0]).replacements.map((item) => item.id));
        else if (replacementIds.length) setSelected(replacementIds);
        setHistory(snapshot.history ?? []);
        setCustomContexts(snapshot.contextTags ?? []);
        if (snapshot.active?.replacementId && recoveredPivotId) {
          setModelPrimaryId(snapshot.active.replacementId);
          setRecommendation({ replacementId: snapshot.active.replacementId, reason: snapshot.active.reason || "This is one of your approved actions.", firstStep: snapshot.active.firstStep || "Begin with one small step.", alternatives: [], source: snapshot.active.source ?? "fallback" });
          setRecommendationSource(snapshot.active.source ?? "fallback");
          setActiveStartedAt(snapshot.active.startedAt);
          setScreen("active");
        }
      })
      .catch(() => setFlowError("Pivot could not load your saved state. Try refreshing."))
      .finally(() => { if (!cancelled) setStateReady(true); });
    return () => { cancelled = true; };
  }, []);

  const activePivot = pivots.find((pivot) => pivot.id === activePivotId);
  const availableReplacements = useMemo(() => activePivot?.replacements ?? [...replacements, ...customReplacements], [activePivot, customReplacements]);
  const approved = useMemo(() => activePivot?.replacements ?? availableReplacements.filter((item) => selected.includes(item.id)), [activePivot, availableReplacements, selected]);
  const primary = approved.find((item) => item.id === (modelPrimaryId ?? recommendation?.replacementId)) ?? approved[0] ?? replacements[0];
  const alternatives = recommendation ? recommendation.alternatives.map((id) => approved.find((item) => item.id === id)).filter((item): item is Replacement => Boolean(item)) : approved.slice(1, 3);
  const recommendationMatchesPrimary = recommendation?.replacementId === primary.id;
  const firstStep = recommendationMatchesPrimary ? recommendation.firstStep : primary.id === "walk" ? "Put on your shoes and step outside." : primary.id === "breathe" ? "Drop your shoulders. Breathe in for 4, out for 6." : `Begin with 30 seconds of ${primary.name.toLowerCase()}.`;
  const timerDuration = durationInSeconds(primary.duration);
  const timerProgress = timerDuration && timerRemaining !== null ? Math.max(0, Math.min(100, ((timerDuration - timerRemaining) / timerDuration) * 100)) : 0;
  const historyPivots = useMemo(() => Array.from(new Map(history.filter((event) => event.pivotId).map((event) => [event.pivotId!, event.pivotGoal || "Past pivot"]))).map(([id, label]) => ({ id, label })), [history]);
  const visibleHistory = historyFilter === "all" ? history : history.filter((event) => event.pivotId === historyFilter);

  useEffect(() => {
    if (screen !== "active" || !activeStartedAt || !timerDuration) return;
    const updateTimer = () => setTimerRemaining(Math.max(0, Math.ceil((new Date(activeStartedAt).getTime() + timerDuration * 1000 - Date.now()) / 1000)));
    const timeout = window.setTimeout(updateTimer, 0);
    const interval = window.setInterval(updateTimer, 1000);
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); };
  }, [activeStartedAt, screen, timerDuration]);

  async function requestRecommendation() {
    if (!activePivot || !approved.length || isRecommending) return;
    setIsRecommending(true);
    setFlowError("");
    setRecommendationSource("fallback");
    const fallback: RecommendationResult = {
      replacementId: approved[0].id,
      reason: "It is an approved option that can change the shape of this moment.",
      firstStep: `Begin with 30 seconds of ${approved[0].name.toLowerCase()}.`,
      alternatives: approved.slice(1, 3).map((item) => item.id),
      source: "fallback",
    };
    const recommendationContext = [context, contextNote].filter(Boolean).join(". ");
    const response = await fetch("/api/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replacements: approved, context: recommendationContext, pivotId: activePivot.id }),
    }).catch(() => null);
    const result = response?.ok ? await response.json().catch(() => null) : null;
    setIsRecommending(false);
    if (result?.route === "support" || result?.route === "specialized") {
      setSafetyKind(result.route === "support" ? "high-risk" : "specialized");
      setScreen("safety");
      return;
    }
    const next = result?.replacementId ? result as RecommendationResult : fallback;
    if (!result?.replacementId) setFlowError("Pivot could not reach the recommendation service, so it chose a safe approved action locally.");
    setRecommendation(next);
    setModelPrimaryId(next.replacementId);
    setRecommendationSource(next.source === "gemini" ? "gemini" : "fallback");
    setScreen("recommendation");
  }

  async function startAction(item: Replacement) {
    if (!activePivot || isStarting) return;
    setIsStarting(true);
    setFlowError("");
    const chosenMatchesRecommendation = recommendation?.replacementId === item.id;
    const chosenFirstStep = chosenMatchesRecommendation ? recommendation.firstStep : item.id === "walk" ? "Put on your shoes and step outside." : item.id === "breathe" ? "Drop your shoulders. Breathe in for 4, out for 6." : `Begin with 30 seconds of ${item.name.toLowerCase()}.`;
    const chosenReason = chosenMatchesRecommendation ? recommendation.reason : item.detail;
    const chosenSource = chosenMatchesRecommendation ? recommendation.source : "fallback";
    const response = await fetch("/api/intervention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pivotId: activePivot.id, replacementId: item.id, reason: chosenReason, firstStep: chosenFirstStep, source: chosenSource }),
    }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    if (!response?.ok) setFlowError("This action could not be saved for refresh recovery, but you can still continue with it.");
    setRecommendation({ replacementId: item.id, reason: chosenReason, firstStep: chosenFirstStep, alternatives: [], source: chosenSource });
    setRecommendationSource(chosenSource);
    setModelPrimaryId(item.id);
    setTimerRemaining(null);
    setActiveStartedAt(payload?.active?.startedAt ?? new Date().toISOString());
    setIsStarting(false);
    setScreen("active");
  }

  async function complete(outcome: string, helpful: boolean) {
    if (!activePivot || isCompleting) return;
    setIsCompleting(true);
    setFlowError("");
    const response = await fetch("/api/closed-loop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pivotId: activePivot.id,
        replacementId: primary.id,
        intensity: urge,
        contextType: context,
        reason: recommendationMatchesPrimary && recommendation ? recommendation.reason : primary.detail,
        firstStep,
        source: recommendationSource,
        outcome,
        helpful,
      }),
    }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    setIsCompleting(false);
    if (!response?.ok) {
      setFlowError("Your check-in could not be saved. Please try again.");
      return;
    }
    const next = [{ id: payload?.eventId, pivotId: activePivot.id, pivotGoal: activePivot.goal, date: new Date().toISOString(), choice: primary.name, outcome }, ...history];
    setHistory(next);
    localStorage.setItem("pivot-state", JSON.stringify({ goal, selected, customReplacements, pivots, activePivotId, customContexts, history: next }));
    setCompletionMessage(outcome === "I went back to it" ? "Recorded without judgment. The next moment is a fresh chance." : "Check-in saved. Small moments count.");
    setScreen("home");
    setActiveStartedAt(null);
    setTimerRemaining(null);
    setFollowupOutcome("");
    setContext("");
    setContextNote("");
    setUrge(7);
  }

  function reset() {
    setScreen("home");
    setFlowError("");
    setFollowupOutcome("");
  }

  function addContextTag() {
    const tag = customContext.trim();
    if (!tag || customContexts.some((item) => item.toLowerCase() === tag.toLowerCase())) return;
    const next = [...customContexts, tag];
    setCustomContexts(next);
    setContext(tag);
    setCustomContext("");
    localStorage.setItem("pivot-state", JSON.stringify({ goal, selected, customReplacements, pivots, activePivotId, customContexts: next, history }));
    void fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: tag }) });
  }

  function choosePivot(id: string) {
    const pivot = pivots.find((item) => item.id === id);
    setActivePivotId(id);
    setSelected(pivot?.replacements.map((item) => item.id) ?? []);
    setModelPrimaryId(null);
    setRecommendation(null);
    setFlowError("");
    localStorage.setItem("pivot-state", JSON.stringify({ goal, selected: pivot?.replacements.map((item) => item.id) ?? [], customReplacements, pivots, activePivotId: id, customContexts, history }));
  }

  function formatHistoryDate(value: string) {
    if (value === "Today") return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  async function removeHistoryEvent(id: string) {
    const response = await fetch(`/api/history/${id}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) setHistory((current) => current.filter((item) => item.id !== id));
    else setFlowError("That History entry could not be deleted.");
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <Header onHistory={() => { setHistoryFilter("all"); setScreen("history"); }} onReset={reset} />

        {screen === "home" && (
          <section className="home-screen">
            <div className="home-primary">
              <div className="home-intro">
                <p className="eyebrow">Your pause space</p>
                <h1>Ready when you are.</h1>
                <p className="lede">One moment at a time. No judgment, no streaks.</p>
              </div>
              {completionMessage && <p className="success-status" role="status">{completionMessage}</p>}
              {flowError && <p className="form-status" role="status">{flowError}</p>}
              <button className="urge-button" disabled={!activePivot || !stateReady} onClick={() => { setCompletionMessage(""); setScreen("urge"); }}>
                <span className="urge-symbol">✳</span>
                <span>
                  <strong>{activePivot ? "I’m having an urge" : stateReady ? "Create a pivot first" : "Loading your pivots"}</strong>
                  <small>{activePivot ? "Let’s find a next step" : stateReady ? "Choose what you want to change" : "Just a moment"}</small>
                </span>
                <span className="arrow">→</span>
              </button>
            </div>
            <aside className="home-aside" aria-label="Pivot overview">
              <div className="today-card">
                <div>
                  <span className="card-kicker">CURRENT PIVOT</span>
                  {activePivot ? (
                    <>
                      <h2>{activePivot.goal}</h2>
                      {pivots.length > 1 && (
                        <div className="pivot-switcher" aria-label="Choose a pivot">
                          {pivots.map((pivot) => <button disabled={!stateReady} className={pivot.id === activePivotId ? "active" : ""} key={pivot.id} onClick={() => choosePivot(pivot.id)}>{pivot.goal}</button>)}
                        </div>
                      )}
                    </>
                  ) : stateReady ? <Link className="onboarding-link" href="/onboarding">Set up your first pivot →</Link> : <span className="settings-copy">Loading...</span>}
                </div>
                <Link className="icon-button" aria-label="Edit pivots" href="/settings/pivots">✎</Link>
              </div>
              <div className="evidence">
                <span className="evidence-icon">✦</span>
                <div>
                  <strong>{history.length ? `${history.length} moment${history.length === 1 ? "" : "s"} redirected` : "Your first pivot starts here"}</strong>
                  <p>{history.length ? "Small actions add up." : "There’s no perfect way to begin."}</p>
                </div>
              </div>
              <div className="home-aside-note">
                <span className="card-kicker">A SMALL REMINDER</span>
                <p>There is no perfect way to begin. Just choose the next useful thing.</p>
              </div>
            </aside>
          </section>
        )}

        {screen === "urge" && (
          <section className="flow-screen">
            <Progress step={1} total={3} />
            <p className="eyebrow">Right now</p>
            <h1>What’s this moment like?</h1>
            <p className="lede">A little context helps me find a better fit. You can skip this.</p>
            <div className="chip-row">
              {["Bored", "Stressed", "Tired", "Avoiding something", "Just automatic", ...customContexts].map((item) => <button className={`chip ${context === item ? "active" : ""}`} key={item} onClick={() => setContext(context === item ? "" : item)}>{item}</button>)}
            </div>
            <label className="field-label" htmlFor="custom-context">Add your own tag <span>Optional</span></label>
            <div className="goal-add-row context-add-row">
              <input id="custom-context" className="text-input" placeholder="e.g. restless, lonely, procrastinating" value={customContext} onChange={(event) => setCustomContext(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addContextTag(); } }} />
              <button className="small-button" onClick={addContextTag} disabled={!customContext.trim()}>Add</button>
            </div>
            <label className="field-label" htmlFor="context-note">Anything else on your mind? <span>Optional</span></label>
            <textarea id="context-note" className="text-input text-area" placeholder="A few words, if useful" value={contextNote} onChange={(event) => setContextNote(event.target.value)} />
            <p className="private-field-note">This note is used for this recommendation and is not saved to History.</p>
            <div className="intensity">
              <div><span className="field-label">How strong is it?</span><strong>{urge} / 10</strong></div>
              <input type="range" min="1" max="10" value={urge} onChange={(event) => setUrge(Number(event.target.value))} aria-label="Urge intensity" />
            </div>
            {flowError && <p className="form-status" role="status">{flowError}</p>}
            <button className="primary-button full" disabled={isRecommending} onClick={requestRecommendation}>{isRecommending ? "Finding a next step..." : "Show me a next step"} <span>→</span></button>
            <button className="quiet-button" disabled={isRecommending} onClick={requestRecommendation}>Skip and show me something</button>
          </section>
        )}

        {screen === "recommendation" && (
          <section className="flow-screen">
            <Progress step={2} total={3} />
            <p className="eyebrow">A gentle pivot</p>
            <h1>Try this for {primary.duration}.</h1>
            <p className="lede">Based on what you’ve shared, this is a simple place to start.</p>
            {flowError && <p className="form-status" role="status">{flowError}</p>}
            <article className="recommend-card">
              <div className="recommend-icon"><ReplacementIcon name={primary.icon} /></div>
              <div>
                <span className="card-kicker">YOUR RECOMMENDATION</span>
                <h2>{primary.name}</h2>
                <p>{primary.detail}</p>
                <div className="reason">✦ {recommendation?.reason ?? primary.detail}</div>
              </div>
            </article>
            <button className="primary-button full" disabled={isStarting} onClick={() => startAction(primary)}>{isStarting ? "Saving action..." : "Start this action"} <span>→</span></button>
            {alternatives.length > 0 && (
              <div className="alternatives">
                <p className="field-label">Or choose another</p>
                {alternatives.map((item) => <button disabled={isStarting} key={item.id} className="alternative" onClick={() => startAction(item)}><span><ReplacementIcon name={item.icon} /></span><span><strong>{item.name}</strong><small>{item.duration}</small></span><b>→</b></button>)}
              </div>
            )}
            <button className="quiet-button" disabled={isStarting} onClick={() => setScreen("urge")}>Not quite - adjust context</button>
          </section>
        )}

        {screen === "active" && (
          <section className="active-screen">
            <div className="active-orbit" style={{ background: `conic-gradient(var(--sage) ${timerProgress}%, #e7ede5 ${timerProgress}%)` }}>
              <div className="orbit-inner">
                <span>✳</span>
                <strong>{timerRemaining === null ? primary.duration : timerRemaining === 0 ? "Done" : formatTimer(timerRemaining)}</strong>
                <small>{timerRemaining === 0 ? "when you are" : timerRemaining === null ? "for you" : "remaining"}</small>
              </div>
            </div>
            <p className="eyebrow">You’re in it</p>
            <h1>{primary.name}</h1>
            <p className="lede">Start with one small step. The urge can be here while you do it.</p>
            {flowError && <p className="form-status" role="status">{flowError}</p>}
            <div className="first-step">
              <span className="step-number">1</span>
              <div><span className="card-kicker">FIRST STEP</span><p>{firstStep}</p></div>
            </div>
            <button className="primary-button full" onClick={() => setScreen("followup")}>I’m done for now <span>→</span></button>
            <button className="quiet-button" onClick={() => setScreen("followup")}>I stopped early</button>
          </section>
        )}

        {screen === "followup" && (
          <section className="flow-screen">
            <Progress step={3} total={3} />
            {!followupOutcome ? (
              <>
                <p className="eyebrow">A quick check-in</p>
                <h1>How is the urge now?</h1>
                <p className="lede">There’s no right answer. This helps Pivot learn what supports you.</p>
                <div className="rating-grid">
                  {["Much lighter", "A little lighter", "About the same", "Stronger"].map((item, index) => <button key={item} className="rating" onClick={() => setFollowupOutcome(item)}><span>{["☼", "◒", "○", "△"][index]}</span>{item}</button>)}
                </div>
                <button className="secondary-button full lapse-button" onClick={() => setFollowupOutcome("I went back to it")}>I went back to it <span>→</span></button>
                <button className="quiet-button" disabled={isCompleting} onClick={() => complete("Skipped", false)}>Skip check-in</button>
              </>
            ) : (
              <>
                <p className="eyebrow">One last detail</p>
                <h1>Did this action help?</h1>
                <p className="lede">You said the urge is “{followupOutcome.toLowerCase()}.” Was {primary.name.toLowerCase()} useful this time?</p>
                {flowError && <p className="form-status" role="status">{flowError}</p>}
                <div className="helpfulness-actions">
                  <button className="primary-button full" disabled={isCompleting} onClick={() => complete(followupOutcome, true)}>{isCompleting ? "Saving..." : "Yes, it helped"}<span>→</span></button>
                  <button className="secondary-button full" disabled={isCompleting} onClick={() => complete(followupOutcome, false)}>Not this time <span>→</span></button>
                </div>
                <button className="quiet-button" disabled={isCompleting} onClick={() => setFollowupOutcome("")}>Back</button>
              </>
            )}
          </section>
        )}

        {screen === "history" && (
          <section className="history-screen">
            <div className="history-heading">
              <p className="eyebrow">Your evidence</p>
              <h1>Small moments count.</h1>
              <p className="lede">A quiet record of the times you chose a different next step.</p>
            </div>
            <div className="history-layout">
              <div className="history-main">
                {historyPivots.length > 1 && <div className="history-filters" aria-label="Filter History by pivot"><button className={historyFilter === "all" ? "active" : ""} onClick={() => setHistoryFilter("all")}>All</button>{historyPivots.map((pivot) => <button className={historyFilter === pivot.id ? "active" : ""} key={pivot.id} onClick={() => setHistoryFilter(pivot.id)}>{pivot.label}</button>)}</div>}
                <div className="history-stat"><strong>{visibleHistory.length}</strong><span>redirected {visibleHistory.length === 1 ? "moment" : "moments"}</span></div>
                {flowError && <p className="form-status" role="status">{flowError}</p>}
                {visibleHistory.length ? (
                  <div className="history-list">
                    {visibleHistory.map((item, index) => <article key={item.id ?? `${item.date}-${index}`}><span className="history-dot">✦</span><div><strong>{item.choice}</strong><p>{item.pivotGoal && `${item.pivotGoal} · `}{item.outcome} · {formatHistoryDate(item.date)}</p></div>{item.id && <button className="history-delete" aria-label={`Delete ${item.choice} History entry`} onClick={() => removeHistoryEvent(item.id!)}>×</button>}</article>)}
                  </div>
                ) : <div className="empty-state">{historyFilter === "all" ? "Your first entry will appear here after a pivot." : "No check-ins for this pivot yet."}</div>}
              </div>
              <aside className="history-aside">
                <div className="history-aside-card">
                  <span className="evidence-icon">✦</span>
                  <span className="card-kicker">KEEP GOING</span>
                  <p>History is evidence, not a scorecard. Every check-in gives you useful information.</p>
                </div>
                <button className="primary-button full" onClick={() => setScreen("home")}>Back to pause space</button>
                <Link className="quiet-button history-settings-link" href="/settings">Manage export and deletion in Settings</Link>
              </aside>
            </div>
          </section>
        )}

        {screen === "safety" && (
          <section className="flow-screen">
            <p className="eyebrow">A different kind of support</p>
            <h1>{safetyKind === "high-risk" ? "This may need immediate support." : "This needs specialized support."}</h1>
            {safetyKind === "high-risk" ? (
              <>
                <p className="lede">Pivot is not crisis care. If you might hurt yourself or someone else, contact local emergency services or a trusted person now.</p>
                <div className="support-card">
                  <strong>In the United States or Canada</strong>
                  <p>Call or text 988 to reach trained crisis support. If there is immediate danger, call emergency services.</p>
                  <a href="tel:988" className="primary-button full">Call 988 <span>→</span></a>
                </div>
              </>
            ) : (
              <>
                <p className="lede">Pivot is designed for everyday habits, not clinical treatment. A qualified professional or specialized service can offer safer, more appropriate support for this.</p>
                <div className="support-card"><strong>You can still take one small step</strong><p>Consider contacting a healthcare professional or someone you trust who can help you find specialized support.</p></div>
              </>
            )}
            <button className="quiet-button" onClick={() => setScreen("home")}>Return to Pivot</button>
          </section>
        )}
      </div>
    </main>
  );
}
