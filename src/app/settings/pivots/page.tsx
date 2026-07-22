"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, type UtilityNavItem } from "@/components/pivot/app-shell";
import { Icon } from "@/components/pivot/ui";

type Pivot = { id: string; goal: string; replacements: { id: string; name: string }[] };
type HistoryEvent = { pivotId?: string };

const utilityNav: UtilityNavItem[] = [
  { kind: "link", label: "Pause space", icon: "home", href: "/" },
  { kind: "link", label: "History", icon: "history", href: "/?screen=history" },
  { kind: "link", label: "Settings", icon: "settings", href: "/settings", active: true },
];

export default function PivotsPage() {
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [pivotCounts, setPivotCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { pivots?: Pivot[]; history?: HistoryEvent[] } | null) => {
      setPivots(snapshot?.pivots ?? []);
      setPivotCounts((snapshot?.history ?? []).reduce<Record<string, number>>((acc, event) => { if (event.pivotId) acc[event.pivotId] = (acc[event.pivotId] ?? 0) + 1; return acc; }, {}));
    }).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell pivots={pivots.map((pivot) => ({ id: pivot.id, goal: pivot.goal }))} activePivotId={null} pivotCounts={pivotCounts} utilityNav={utilityNav}>
      <div className="settings-page">
        <section className="settings-intro">
          <p className="eyebrow">Your directions</p>
          <h1>Manage pivots</h1>
          <p className="lede">Each pivot keeps its own ordered set of actions.</p>
        </section>
        <Link className="primary-button full" href="/settings/pivots/new">Create a pivot <Icon name="plus" size={16} /></Link>
        <section className="settings-section">
          {loading ? <div className="empty-state" role="status">Loading pivots...</div> : pivots.length ? <div className="settings-list">{pivots.map((pivot) => <article className="settings-pivot" key={pivot.id}><div><strong>{pivot.goal}</strong><span>{pivot.replacements.length} approved action{pivot.replacements.length === 1 ? "" : "s"}</span></div><Link href={`/settings/pivots/${pivot.id}`} aria-label={`Edit ${pivot.goal}`}>Edit</Link></article>)}</div> : <div className="empty-state">Create your first pivot to get started.</div>}
        </section>
      </div>
    </AppShell>
  );
}
