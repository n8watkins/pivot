"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/pivot/ui";

type Pivot = { id: string; goal: string; replacements: { id: string; name: string }[] };

export default function PivotsPage() {
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { pivots?: Pivot[] } | null) => setPivots(snapshot?.pivots ?? [])).finally(() => setLoading(false)); }, []);
  return <main className="app-shell"><div className="app-frame settings-page"><header className="site-header"><Link className="brand" href="/"><Logo /><span>pivot</span></Link><Link className="text-button" href="/settings">Done <span aria-hidden="true">×</span></Link></header><section className="settings-intro"><p className="eyebrow">Your directions</p><h1>Manage pivots</h1><p className="lede">Each pivot keeps its own ordered set of actions.</p></section><Link className="primary-button full" href="/settings/pivots/new">Create a pivot <span>＋</span></Link><section className="settings-section">{loading ? <div className="empty-state" role="status">Loading pivots...</div> : pivots.length ? <div className="settings-list">{pivots.map((pivot) => <article className="settings-pivot" key={pivot.id}><div><strong>{pivot.goal}</strong><span>{pivot.replacements.length} approved action{pivot.replacements.length === 1 ? "" : "s"}</span></div><Link href={`/settings/pivots/${pivot.id}`} aria-label={`Edit ${pivot.goal}`}>Edit</Link></article>)}</div> : <div className="empty-state">Create your first pivot to get started.</div>}</section></div></main>;
}
