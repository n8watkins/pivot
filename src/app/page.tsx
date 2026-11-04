"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultContextTags, replacements, type Replacement } from "@/components/pivot/data";
import { AppShell, type UtilityNavItem } from "@/components/pivot/app-shell";
import { PivotStatsRail } from "@/components/pivot/pivot-stats-rail";
import { Icon, Progress, ReplacementIcon } from "@/components/pivot/ui";
import { assessSafety, crisisResources, type CrisisCategory, type SpecializedCategory } from "@/lib/crisis";
import { resourcesForCrisis, resourcesForSpecialized } from "@/lib/crisis-resources";
import { EmergencyAndInternational, ResourceList } from "@/components/pivot/crisis-resources";
import { rankWithContext } from "@/lib/ranking";
import { fallbackFirstStep } from "@/lib/replacement-copy";
import { RECOMMENDATION_REQUEST_TIMEOUT_MS } from "@/lib/gemini";
import { usePivotDataChanged, useUndoToast } from "@/components/pivot/undo-toast";

type Screen = "home" | "urge" | "recommendation" | "active" | "followup" | "history" | "safety";
type Pivot = { id: string; goal: string; replacements: Replacement[] };
type HistoryEvent = { id?: string; pivotId?: string; pivotGoal?: string; date: string; choice: string; outcome: string; replacementId?: string; helpful?: boolean; contextType?: string };
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

function appHref(pivotId: string | null, view: "home" | "history" = "home", historyFilter = "all") {
  const params = new URLSearchParams();
  if (pivotId) params.set("pivot", pivotId);
  if (view === "history") {
    params.set("screen", "history");
    if (historyFilter !== "all") params.set("historyPivot", historyFilter);
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function updateAppUrl(href: string, mode: "push" | "replace") {
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", href);
}

export default function Home() {
  const activePivotIdRef = useRef<string | null>(null);
  const flowRequestVersionRef = useRef(0);
  const [screen, setScreen] = useState<Screen>("home");
  const [goal, setGoal] = useState("");
  const [selected, setSelected] = useState<string[]>(["walk", "breathe", "stretch"]);
  const [customReplacements, setCustomReplacements] = useState<Replacement[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [activePivotId, setActivePivotId] = useState<string | null>(null);
  const [stateReady, setStateReady] = useState(false);
  const [urge, setUrge] = useState(7);
  // The slider starts at 7; only an intensity the user actually set should steer the pick.
  const [urgeTouched, setUrgeTouched] = useState(false);
  const [context, setContext] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [customContexts, setCustomContexts] = useState<string[]>([]);
  const [modelPrimaryId, setModelPrimaryId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [activeStartedAt, setActiveStartedAt] = useState<string | null>(null);
  const [activeInterventionId, setActiveInterventionId] = useState<string | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [followupOutcome, setFollowupOutcome] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [isRecommending, setIsRecommending] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [safetyKind, setSafetyKind] = useState<"high-risk" | "specialized">("high-risk");
  const [safetyCategories, setSafetyCategories] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const { showDeleted } = useUndoToast();

  // An Undo brings a deleted pivot or History entry back: refresh those lists, not the flow.
  usePivotDataChanged(() => {
    void fetch("/api/state")
      .then((response) => response.ok ? response.json() : null)
      .then((snapshot: { pivots?: { id: string; goal: string; replacements: Omit<Replacement, "icon">[] }[]; history?: HistoryEvent[]; contextTags?: string[] } | null) => {
        if (!snapshot) return;
        setPivots(snapshot.pivots?.map((pivot) => ({ ...pivot, replacements: pivot.replacements.map((item) => ({ ...item, icon: replacements.find((option) => option.id === item.id)?.icon ?? "custom" })) })) ?? []);
        setHistory(snapshot.history ?? []);
        setCustomContexts(snapshot.contextTags ?? []);
      })
      .catch(() => undefined);
  });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/state")
      .then((response) => response.ok ? response.json() : null)
      .then((snapshot: { goal?: string; goals?: string[]; replacements?: Omit<Replacement, "icon">[]; pivots?: { id: string; goal: string; replacements: Omit<Replacement, "icon">[] }[]; contextTags?: string[]; history?: HistoryEvent[]; active?: { id: string; pivotId?: string; replacementId: string; reason?: string; firstStep?: string; source?: "gemini" | "fallback"; startedAt: string } } | null) => {
        if (cancelled || !snapshot) return;
        const serverPivots = snapshot.pivots?.map((pivot) => ({
          ...pivot,
          replacements: pivot.replacements.map((item) => ({ ...item, icon: replacements.find((option) => option.id === item.id)?.icon ?? "custom" })),
        })) ?? [];
        const replacementIds = snapshot.replacements?.map((item) => item.id) ?? [];
        const serverCustom = snapshot.replacements?.filter((item) => !replacements.some((option) => option.id === item.id)).map((item) => ({ ...item, icon: "custom" })) ?? [];
        const recoveredPivotId = snapshot.active?.pivotId || serverPivots.find((pivot) => pivot.replacements.some((item) => item.id === snapshot.active?.replacementId))?.id;
        const params = new URLSearchParams(window.location.search);
        const requestedPivotId = params.get("pivot");
        const preselectedPivotId = requestedPivotId && serverPivots.some((pivot) => pivot.id === requestedPivotId) && !snapshot.active?.replacementId ? requestedPivotId : undefined;
        const initialPivotId = preselectedPivotId ?? recoveredPivotId ?? serverPivots[0]?.id ?? null;

        setGoal(snapshot.goals?.[0] ?? snapshot.goal ?? "");
        setCustomReplacements(serverCustom);
        setPivots(serverPivots);
        activePivotIdRef.current = initialPivotId;
        setActivePivotId(initialPivotId);
        if (serverPivots[0]) setSelected((serverPivots.find((pivot) => pivot.id === initialPivotId) ?? serverPivots[0]).replacements.map((item) => item.id));
        else if (replacementIds.length) setSelected(replacementIds);
        setHistory(snapshot.history ?? []);
        setCustomContexts(snapshot.contextTags ?? []);
        const requestedHistoryPivot = params.get("historyPivot");
        if (requestedHistoryPivot && (snapshot.history ?? []).some((event) => event.pivotId === requestedHistoryPivot)) setHistoryFilter(requestedHistoryPivot);
        if (snapshot.active?.replacementId && recoveredPivotId) {
          setActiveInterventionId(snapshot.active.id);
          setModelPrimaryId(snapshot.active.replacementId);
          setRecommendation({ replacementId: snapshot.active.replacementId, reason: snapshot.active.reason || "This is one of your approved actions.", firstStep: snapshot.active.firstStep || "Begin with one small step.", alternatives: [], source: snapshot.active.source ?? "fallback" });
          setActiveStartedAt(snapshot.active.startedAt);
          setScreen("active");
        } else if (params.get("screen") === "history") {
          setScreen("history");
        }
      })
      .catch(() => setFlowError("Pivot could not load your saved state. Try refreshing."))
      .finally(() => { if (!cancelled) setStateReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function syncRouteFromHistory() {
      if (activeStartedAt || isStarting) return;
      const params = new URLSearchParams(window.location.search);
      const requestedPivotId = params.get("pivot");
      const nextPivot = requestedPivotId ? pivots.find((pivot) => pivot.id === requestedPivotId) : pivots[0];
      if (nextPivot) {
        flowRequestVersionRef.current += 1;
        activePivotIdRef.current = nextPivot.id;
        setActivePivotId(nextPivot.id);
        setSelected(nextPivot.replacements.map((item) => item.id));
        setModelPrimaryId(null);
        setRecommendation(null);
        setIsRecommending(false);
      }
      if (params.get("screen") === "history") {
        const requestedFilter = params.get("historyPivot");
        setHistoryFilter(requestedFilter && history.some((event) => event.pivotId === requestedFilter) ? requestedFilter : "all");
        setScreen("history");
      } else {
        setHistoryFilter("all");
        setScreen("home");
      }
    }

    window.addEventListener("popstate", syncRouteFromHistory);
    return () => window.removeEventListener("popstate", syncRouteFromHistory);
  }, [activeStartedAt, history, isStarting, pivots]);

  const activePivot = pivots.find((pivot) => pivot.id === activePivotId);
  const availableReplacements = useMemo(() => activePivot?.replacements ?? [...replacements, ...customReplacements], [activePivot, customReplacements]);
  const approved = useMemo(() => activePivot?.replacements ?? availableReplacements.filter((item) => selected.includes(item.id)), [activePivot, availableReplacements, selected]);
  const primary = approved.find((item) => item.id === (modelPrimaryId ?? recommendation?.replacementId)) ?? approved[0] ?? replacements[0];
  const alternatives = recommendation ? recommendation.alternatives.map((id) => approved.find((item) => item.id === id)).filter((item): item is Replacement => Boolean(item)) : approved.slice(1, 3);
  const recommendationMatchesPrimary = recommendation?.replacementId === primary.id;
  const firstStep = recommendationMatchesPrimary ? recommendation.firstStep : fallbackFirstStep(primary);
  const timerDuration = durationInSeconds(primary.duration);
  const timerProgress = timerDuration && timerRemaining !== null ? Math.max(0, Math.min(100, ((timerDuration - timerRemaining) / timerDuration) * 100)) : 0;
  const historyPivots = useMemo(() => Array.from(new Map(history.filter((event) => event.pivotId).map((event) => [event.pivotId!, event.pivotGoal || "Past pivot"]))).map(([id, label]) => ({ id, label })), [history]);
  const visibleHistory = historyFilter === "all" ? history : history.filter((event) => event.pivotId === historyFilter);
  const pivotCounts = useMemo(() => history.reduce<Record<string, number>>((acc, event) => { if (event.pivotId) acc[event.pivotId] = (acc[event.pivotId] ?? 0) + 1; return acc; }, {}), [history]);
  const activeRecent = useMemo(() => history.filter((event) => event.pivotId === activePivotId).slice(0, 3).map((event) => ({ id: event.id, choice: event.choice, outcome: event.outcome, date: event.date })), [history, activePivotId]);

  // Each step starts at the top, so a new screen (especially crisis resources) is never shown mid-page.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen]);

  useEffect(() => {
    if (screen !== "active" || !activeStartedAt || !timerDuration) return;
    const updateTimer = () => setTimerRemaining(Math.max(0, Math.ceil((new Date(activeStartedAt).getTime() + timerDuration * 1000 - Date.now()) / 1000)));
    const timeout = window.setTimeout(updateTimer, 0);
    const interval = window.setInterval(updateTimer, 1000);
    return () => { window.clearTimeout(timeout); window.clearInterval(interval); };
  }, [activeStartedAt, screen, timerDuration]);

  async function requestRecommendation() {
    if (!activePivot || !approved.length || isRecommending) return;
    const requestVersion = ++flowRequestVersionRef.current;
    const requestedPivotId = activePivot.id;
    setIsRecommending(true);
    setFlowError("");
    const localRanking = rankWithContext(approved, { tag: context, intensity: urgeTouched ? urge : undefined, hour: new Date().getHours() }, history.filter((event) => event.pivotId === requestedPivotId && event.replacementId).map((event) => ({ replacementId: event.replacementId!, helpful: Boolean(event.helpful), contextType: event.contextType })));
    const fallback: RecommendationResult = {
      replacementId: localRanking[0].action.id,
      reason: localRanking[0].reason,
      firstStep: fallbackFirstStep(localRanking[0].action),
      alternatives: localRanking.slice(1, 3).map((entry) => entry.action.id),
      source: "fallback",
    };
    const recommendationContext = [context, contextNote].filter(Boolean).join(". ");
    // Check on the device first, so crisis resources appear immediately and never depend on
    // the network or the recommendation service. The server repeats the same check.
    const assessment = assessSafety(recommendationContext);
    if (assessment.route) {
      setIsRecommending(false);
      setSafetyKind(assessment.route === "crisis" ? "high-risk" : "specialized");
      setSafetyCategories(assessment.categories);
      setScreen("safety");
      return;
    }
    const response = await fetch("/api/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(RECOMMENDATION_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({ replacements: approved, context: recommendationContext, pivotId: activePivot.id, tag: context, intensity: urgeTouched ? urge : undefined, hour: new Date().getHours() }),
    }).catch(() => null);
    const result = response?.ok ? await response.json().catch(() => null) : null;
    if (flowRequestVersionRef.current !== requestVersion || activePivotIdRef.current !== requestedPivotId) return;
    setIsRecommending(false);
    if (result?.route === "support" || result?.route === "specialized") {
      setSafetyKind(result.route === "support" ? "high-risk" : "specialized");
      setSafetyCategories(Array.isArray(result.categories) ? result.categories.filter((item: unknown): item is string => typeof item === "string") : []);
      setScreen("safety");
      return;
    }
    const next = result?.replacementId ? result as RecommendationResult : fallback;
    if (!result?.replacementId) setFlowError("Pivot could not reach the recommendation service, so it chose a safe approved action locally.");
    setRecommendation(next);
    setModelPrimaryId(next.replacementId);
    setScreen("recommendation");
  }

  async function startAction(item: Replacement) {
    if (!activePivot || isStarting) return;
    const requestVersion = ++flowRequestVersionRef.current;
    const requestedPivot = activePivot;
    setIsStarting(true);
    setFlowError("");
    const chosenMatchesRecommendation = recommendation?.replacementId === item.id;
    const chosenFirstStep = chosenMatchesRecommendation ? recommendation.firstStep : fallbackFirstStep(item);
    const chosenReason = chosenMatchesRecommendation ? recommendation.reason : item.detail;
    const chosenSource = chosenMatchesRecommendation ? recommendation.source : "fallback";
    const response = await fetch("/api/intervention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({ pivotId: activePivot.id, replacementId: item.id, reason: chosenReason, firstStep: chosenFirstStep, source: chosenSource, intensity: urge, contextType: context }),
    }).catch(() => null);
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    if (flowRequestVersionRef.current !== requestVersion) {
      setIsStarting(false);
      return;
    }
    activePivotIdRef.current = requestedPivot.id;
    setActivePivotId(requestedPivot.id);
    setSelected(requestedPivot.replacements.map((replacement) => replacement.id));
    if (!response?.ok) {
      setFlowError("This action could not be saved. Please try starting it again.");
      setIsStarting(false);
      return;
    }
    setRecommendation({ replacementId: item.id, reason: chosenReason, firstStep: chosenFirstStep, alternatives: [], source: chosenSource });
    setModelPrimaryId(item.id);
    setTimerRemaining(null);
    setActiveInterventionId(payload?.active?.id ?? null);
    setActiveStartedAt(payload?.active?.startedAt ?? new Date().toISOString());
    setIsStarting(false);
    setScreen("active");
    updateAppUrl(appHref(requestedPivot.id), "replace");
  }

  async function complete(outcome: string, helpful: boolean) {
    if (!activePivot || !activeInterventionId || isCompleting) {
      if (!activeInterventionId) setFlowError("This action was not saved. Return home and start it again before checking in.");
      return;
    }
    setIsCompleting(true);
    setFlowError("");
    const response = await fetch("/api/closed-loop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        interventionId: activeInterventionId,
        pivotId: activePivot.id,
        replacementId: primary.id,
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
    const next = [{ id: payload?.eventId, pivotId: activePivot.id, pivotGoal: activePivot.goal, date: new Date().toISOString(), choice: primary.name, outcome, replacementId: primary.id, helpful, contextType: context }, ...history];
    setHistory(next);
    localStorage.setItem("pivot-state", JSON.stringify({ goal, selected, customReplacements, pivots, activePivotId, customContexts, history: next }));
    setCompletionMessage(outcome === "I went back to it" ? "Recorded without judgment. The next moment is a fresh chance." : "Check-in saved. Small moments count.");
    setScreen("home");
    setActiveStartedAt(null);
    setActiveInterventionId(null);
    setTimerRemaining(null);
    setFollowupOutcome("");
    setContext("");
    setContextNote("");
    setUrge(7);
    setUrgeTouched(false);
    updateAppUrl(appHref(activePivot.id), "replace");
  }

  function reset() {
    flowRequestVersionRef.current += 1;
    setIsRecommending(false);
    setScreen("home");
    setFlowError("");
    setFollowupOutcome("");
    updateAppUrl(appHref(activePivotIdRef.current), "push");
  }

  async function addContextTag() {
    const tag = customContext.trim();
    if (tag.length < 2 || tag.length > 40) {
      setFlowError("Custom tags must be between 2 and 40 characters.");
      return;
    }
    if ([...defaultContextTags, ...customContexts].some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setFlowError("That tag is already available.");
      return;
    }
    setIsSavingContext(true);
    setFlowError("");
    const response = await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: tag }) }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setIsSavingContext(false);
    if (!response?.ok) {
      setFlowError(payload?.error ?? "That tag could not be saved.");
      return;
    }
    const savedTag = typeof payload?.label === "string" ? payload.label : tag;
    const next = [...customContexts, savedTag];
    setCustomContexts(next);
    setContext(savedTag);
    setCustomContext("");
    localStorage.setItem("pivot-state", JSON.stringify({ goal, selected, customReplacements, pivots, activePivotId, customContexts: next, history }));
  }

  function choosePivot(id: string) {
    if (isStarting) return;
    const pivot = pivots.find((item) => item.id === id);
    if (!pivot) return;
    flowRequestVersionRef.current += 1;
    setIsRecommending(false);
    activePivotIdRef.current = id;
    setActivePivotId(id);
    setSelected(pivot.replacements.map((item) => item.id));
    setModelPrimaryId(null);
    setRecommendation(null);
    setFlowError("");
    if (screen === "history") {
      setHistoryFilter(id);
      updateAppUrl(appHref(id, "history", id), "replace");
    } else {
      setScreen("home");
      updateAppUrl(appHref(id), "replace");
    }
    localStorage.setItem("pivot-state", JSON.stringify({ goal, selected: pivot.replacements.map((item) => item.id), customReplacements, pivots, activePivotId: id, customContexts, history }));
  }

  function showHistory() {
    flowRequestVersionRef.current += 1;
    setIsRecommending(false);
    setHistoryFilter("all");
    setScreen("history");
    updateAppUrl(appHref(activePivotIdRef.current, "history"), "push");
  }

  function filterHistory(nextFilter: string) {
    setHistoryFilter(nextFilter);
    updateAppUrl(appHref(activePivotIdRef.current, "history", nextFilter), "replace");
  }

  function formatHistoryDate(value: string) {
    if (value === "Today") return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Recently" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  }

  async function removeHistoryEvent(id: string) {
    const index = history.findIndex((item) => item.id === id);
    const removed = history[index];
    if (!removed) return;
    setFlowError("");
    setHistory((current) => current.filter((item) => item.id !== id));
    const response = await fetch(`/api/history/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setHistory((current) => current.some((item) => item.id === id) ? current : [...current.slice(0, index), removed, ...current.slice(index)]);
      setFlowError("That History entry could not be deleted.");
      return;
    }
    showDeleted({ kind: "history", id, message: `History entry “${removed.choice}” deleted` });
  }

  const utilityNav: UtilityNavItem[] = [
    { kind: "action", label: "Pause space", icon: "home", onClick: reset, active: screen === "home" },
    { kind: "action", label: "History", icon: "history", onClick: showHistory, active: screen === "history" },
    { kind: "link", label: "Settings", icon: "settings", href: "/settings" },
  ];

  return (
    <AppShell
      pivots={pivots.map((pivot) => ({ id: pivot.id, goal: pivot.goal }))}
      activePivotId={activePivotId}
      onSelectPivot={choosePivot}
      pivotCounts={pivotCounts}
      pivotSelectionDisabled={isRecommending || isStarting}
      utilityNav={utilityNav}
      focusMode={isStarting || screen === "active" || screen === "followup"}
      focusLabel={isStarting ? "Starting action" : screen === "active" ? "Action in progress" : screen === "followup" ? "Check-in in progress" : undefined}
      rightRail={screen === "home" && activePivot ? <PivotStatsRail count={activePivotId ? (pivotCounts[activePivotId] ?? 0) : 0} recent={activeRecent} /> : undefined}
    >
      {screen === "home" && (
        <section className="home-screen">
          <div className="home-intro">
            <p className="eyebrow">Your pause space</p>
            <h1>Ready when you are.</h1>
            <p className="lede">One moment at a time. No judgment, no streaks.</p>
          </div>
          {completionMessage && <p className="success-status" role="status">{completionMessage}</p>}
          {flowError && <p className="form-status" role="status">{flowError}</p>}
          {activePivot ? (
            <>
              <h2 className="pivot-context-chip"><span className="dot" aria-hidden="true" />{activePivot.goal}</h2>
              <button className="urge-button" disabled={!stateReady} onClick={() => { setCompletionMessage(""); setScreen("urge"); }}>
                <span className="urge-symbol"><Icon name="spark" size={24} strokeWidth={1.8} /></span>
                <span>
                  <strong>I’m having an urge</strong>
                  <small>Let’s find a next step</small>
                </span>
                <span className="arrow"><Icon name="arrowRight" size={22} /></span>
              </button>
            </>
          ) : (
            <>
              {stateReady ? (
                <Link className="urge-button" href="/onboarding">
                  <span className="urge-symbol"><Icon name="spark" size={24} strokeWidth={1.8} /></span>
                  <span>
                    <strong>Set up your first pivot</strong>
                    <small>Pick a habit and a few things to do instead. About a minute.</small>
                  </span>
                  <span className="arrow"><Icon name="arrowRight" size={20} /></span>
                </Link>
              ) : (
                <button className="urge-button" disabled>
                  <span className="urge-symbol"><Icon name="spark" size={24} strokeWidth={1.8} /></span>
                  <span><strong>Loading your pivots</strong><small>Just a moment</small></span>
                </button>
              )}
              {stateReady && <Link className="onboarding-link" href="/welcome">New here? See how Pivot works <Icon name="arrowRight" size={16} /></Link>}
            </>
          )}
        </section>
      )}

      {screen === "urge" && (
        <section className="flow-screen urge-screen">
          <Progress step={1} total={3} label="Pivot flow progress" />
          <p className="eyebrow">Right now</p>
          <h1>What’s this moment like?</h1>
          <p className="lede">A little context helps me find a better fit. You can skip this.</p>
          <div className="urge-input-grid">
            <div className="urge-context-column">
              <span className="field-label">What fits this moment?</span>
              <div className="chip-row">
                {[...defaultContextTags, ...customContexts].map((item) => <button type="button" aria-pressed={context === item} className={`chip ${context === item ? "active" : ""}`} key={item} onClick={() => setContext(context === item ? "" : item)}>{item}</button>)}
              </div>
              <label className="field-label" htmlFor="custom-context">Add your own tag <span>Optional</span></label>
              <div className="goal-add-row context-add-row">
                <input id="custom-context" className="text-input" placeholder="e.g. restless, lonely" value={customContext} onChange={(event) => setCustomContext(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addContextTag(); } }} />
                <button type="button" className="small-button" onClick={addContextTag} disabled={!customContext.trim() || isSavingContext}>{isSavingContext ? "Saving..." : "Add"}</button>
              </div>
            </div>
            <div className="urge-note-column">
              <label className="field-label" htmlFor="context-note">Anything else on your mind? <span>Optional</span></label>
              <textarea id="context-note" className="text-input text-area" placeholder="A few words, if useful" value={contextNote} onChange={(event) => setContextNote(event.target.value)} />
              <p className="private-field-note">Your note is sent to Google Gemini for this suggestion and is never stored. <Link href="/privacy">Privacy</Link></p>
              <div className="intensity">
                <div><span className="field-label">How strong is it?</span><strong>{urge} / 10</strong></div>
                <input type="range" min="1" max="10" value={urge} onChange={(event) => { setUrge(Number(event.target.value)); setUrgeTouched(true); }} aria-label="Urge intensity" />
              </div>
            </div>
          </div>
          {flowError && <p className="form-status" role="status">{flowError}</p>}
          <div className="urge-actions">
            <button type="button" className="primary-button full" disabled={isRecommending} onClick={requestRecommendation}>{isRecommending ? "Finding a next step..." : "Show me a next step"} <Icon name="arrowRight" size={18} /></button>
            <button type="button" className="quiet-button" disabled={isRecommending} onClick={requestRecommendation}>Skip and show me something</button>
          </div>
        </section>
      )}

      {screen === "recommendation" && (
        <section className="flow-screen">
          <Progress step={2} total={3} label="Pivot flow progress" />
          <p className="eyebrow">A gentle pivot</p>
          <h1>Try this for {primary.duration}.</h1>
          <p className="lede">Based on what you’ve shared, this is a simple place to start.</p>
          {flowError && <p className="form-status" role="status">{flowError}</p>}
          <article className="recommend-card">
            <div className="recommend-icon"><ReplacementIcon name={primary.icon} /></div>
            <div>
              <span className="card-kicker">Your recommendation</span>
              <h2>{primary.name}</h2>
              <p>{primary.detail}</p>
              <div className="reason"><Icon name="sparkle" size={14} /><span>{recommendation?.reason ?? primary.detail}</span></div>
            </div>
          </article>
          <button type="button" className="primary-button full" disabled={isStarting} onClick={() => startAction(primary)}>{isStarting ? "Saving action..." : "Start this action"} <Icon name="arrowRight" size={18} /></button>
          {alternatives.length > 0 && (
            <div className="alternatives">
              <p className="field-label">Or choose another</p>
              {alternatives.map((item) => <button type="button" disabled={isStarting} key={item.id} className="alternative" onClick={() => startAction(item)}><span className="alt-icon"><ReplacementIcon name={item.icon} /></span><span className="alt-body"><strong>{item.name}</strong><small>{item.duration}</small></span><span className="alt-go"><Icon name="arrowRight" size={18} /></span></button>)}
            </div>
          )}
          <button type="button" className="quiet-button" disabled={isStarting} onClick={() => setScreen("urge")}>Not quite - adjust context</button>
        </section>
      )}

      {screen === "active" && (
        <section className="active-screen">
          <div className="active-orbit" style={{ background: `conic-gradient(var(--deep-sage) ${timerProgress}%, var(--sage-track) ${timerProgress}%)` }}>
            <div className="orbit-inner">
              <span className="orbit-mark"><Icon name="spark" size={22} strokeWidth={1.8} /></span>
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
            <div><span className="card-kicker">First step</span><p>{firstStep}</p></div>
          </div>
          <button type="button" className="primary-button full" onClick={() => setScreen("followup")}>I’m done for now <Icon name="arrowRight" size={18} /></button>
          <button type="button" className="quiet-button" onClick={() => setScreen("followup")}>I stopped early</button>
        </section>
      )}

      {screen === "followup" && (
        <section className="flow-screen">
          <Progress step={3} total={3} label="Pivot flow progress" />
          {!followupOutcome ? (
            <>
              <p className="eyebrow">A quick check-in</p>
              <h1>How is the urge now?</h1>
              <p className="lede">There’s no right answer. This helps Pivot learn what supports you.</p>
              <div className="rating-grid">
                {(["Much lighter", "A little lighter", "About the same", "Stronger"] as const).map((item, index) => <button type="button" key={item} className="rating" onClick={() => setFollowupOutcome(item)}><span className="rating-icon"><Icon name={(["ratingMuchLighter", "ratingLighter", "ratingSame", "ratingStronger"] as const)[index]} size={19} /></span>{item}</button>)}
              </div>
              <button type="button" className="secondary-button full lapse-button" onClick={() => setFollowupOutcome("I went back to it")}>I went back to it <Icon name="arrowRight" size={18} /></button>
              <button type="button" className="quiet-button" disabled={isCompleting} onClick={() => complete("Skipped", false)}>Skip check-in</button>
            </>
          ) : (
            <>
              <p className="eyebrow">One last detail</p>
              <h1>Did this action help?</h1>
              <p className="lede">You said the urge is “{followupOutcome.toLowerCase()}.” Did “{primary.name}” help this time?</p>
              {flowError && <p className="form-status" role="status">{flowError}</p>}
              <div className="helpfulness-actions">
                <button type="button" className="primary-button full" disabled={isCompleting} onClick={() => complete(followupOutcome, true)}>{isCompleting ? "Saving..." : "Yes, it helped"} <Icon name="arrowRight" size={18} /></button>
                <button type="button" className="secondary-button full" disabled={isCompleting} onClick={() => complete(followupOutcome, false)}>Not this time <Icon name="arrowRight" size={18} /></button>
              </div>
              <button type="button" className="quiet-button" disabled={isCompleting} onClick={() => setFollowupOutcome("")}>Back</button>
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
          {historyPivots.length > 1 && <div className="history-filters" role="group" aria-label="Filter History by pivot"><button type="button" aria-pressed={historyFilter === "all"} className={historyFilter === "all" ? "active" : ""} onClick={() => filterHistory("all")}>All</button>{historyPivots.map((pivot) => <button type="button" aria-pressed={historyFilter === pivot.id} className={historyFilter === pivot.id ? "active" : ""} key={pivot.id} onClick={() => filterHistory(pivot.id)}>{pivot.label}</button>)}</div>}
          <div className="history-stat"><strong>{visibleHistory.length}</strong><span>redirected {visibleHistory.length === 1 ? "moment" : "moments"}</span></div>
          {flowError && <p className="form-status" role="status">{flowError}</p>}
          {visibleHistory.length ? (
            <div className="history-list">
              {visibleHistory.map((item, index) => <article key={item.id ?? `${item.date}-${index}`}><span className="history-dot"><Icon name="sparkle" size={16} /></span><div><strong>{item.choice}</strong><p>{item.pivotGoal && `${item.pivotGoal} · `}{item.outcome} · {formatHistoryDate(item.date)}</p></div>{item.id && <button type="button" className="history-delete" aria-label={`Delete ${item.choice} History entry`} onClick={() => removeHistoryEvent(item.id!)}><Icon name="close" size={18} /></button>}</article>)}
            </div>
          ) : <div className="empty-state">{historyFilter === "all" ? "Your first entry will appear here after a pivot." : "No check-ins for this pivot yet."}</div>}
          <button type="button" className="primary-button full history-back" onClick={reset}>Back to pause space</button>
        </section>
      )}

      {screen === "safety" && (
        <section className="flow-screen">
          {safetyKind === "high-risk" ? (
            <>
              <p className="eyebrow">Let’s pause here</p>
              <h1 className="crisis-heading">This sounds heavier than what Pivot is built for.</h1>
              <p className="lede">You deserve support from a real person right now. Reaching out is a strong next step.</p>
              <ResourceList resources={resourcesForCrisis(safetyCategories as CrisisCategory[]).filter((resource) => resource.id !== "crisis-text")} />
              <div className="support-card crisis-card">
                <strong>Talk to someone now</strong>
                <p>In the US, call or text <a href={crisisResources.call}>988</a> (Suicide &amp; Crisis Lifeline) any time, or <a href={crisisResources.chat} target="_blank" rel="noopener noreferrer">chat online</a>. It is free and confidential.</p>
                <div className="crisis-actions">
                  <a href={crisisResources.call} className="primary-button full">Call 988 <Icon name="arrowRight" size={18} /></a>
                  <a href={crisisResources.text} className="secondary-button full">Text 988</a>
                </div>
              </div>
              <ResourceList resources={resourcesForCrisis(safetyCategories as CrisisCategory[]).filter((resource) => resource.id === "crisis-text")} />
              <EmergencyAndInternational />
            </>
          ) : (
            <>
              <p className="eyebrow">A different kind of support</p>
              <h1>This needs specialized support.</h1>
              <p className="lede">Pivot is designed for everyday habits, not clinical treatment. A qualified professional or specialized service can offer safer, more appropriate support for this.</p>
              <p className="resource-intro">Free, confidential lines you can reach right now, any time:</p>
              <ResourceList resources={resourcesForSpecialized(safetyCategories as SpecializedCategory[])} />
              <EmergencyAndInternational />
            </>
          )}
          <button type="button" className="quiet-button" onClick={() => { setContextNote(""); reset(); }}>Back to Pivot</button>
        </section>
      )}
    </AppShell>
  );
}
