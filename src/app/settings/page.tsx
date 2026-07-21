"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/pivot/ui";

type Pivot = { id: string; goal: string; replacements: { id: string; name: string }[] };

export default function SettingsPage() {
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { pivots?: Pivot[] } | null) => setPivots(snapshot?.pivots ?? [])).catch(() => setStatus("Could not load your settings."));
  }, []);

  async function deleteData() {
    if (!window.confirm("Delete your pivots, history, and anonymous session from this device?")) return;
    const response = await fetch("/api/session", { method: "DELETE" });
    if (response.ok) { localStorage.removeItem("pivot-state"); window.location.href = "/onboarding"; }
    else setStatus("Your data could not be deleted. Please try again.");
  }

  return <main className="app-shell"><div className="app-frame settings-page"><header className="site-header"><Link className="brand" href="/"><Logo /><span>pivot</span></Link><Link className="text-button" href="/">Done <span aria-hidden="true">×</span></Link></header><section className="settings-intro"><p className="eyebrow">Your space</p><h1>Settings</h1><p className="lede">Keep your pivots clear, private, and shaped around what works for you.</p></section><section className="settings-section"><div className="settings-section-heading"><div><span className="card-kicker">YOUR PIVOTS</span><h2>What you’re practicing</h2></div><Link className="small-button settings-add" href="/onboarding">Add pivot <span>＋</span></Link></div>{pivots.length ? <div className="settings-list">{pivots.map((pivot) => <article className="settings-pivot" key={pivot.id}><div><strong>{pivot.goal}</strong><span>{pivot.replacements.length} approved action{pivot.replacements.length === 1 ? "" : "s"}</span></div><Link href="/onboarding" aria-label={`Edit ${pivot.goal}`}>Edit</Link></article>)}</div> : <div className="empty-state">You haven’t created a pivot yet.</div>}</section><section className="settings-section"><div className="settings-section-heading"><div><span className="card-kicker">ACCOUNT</span><h2>Anonymous for now</h2></div><span className="status-dot">Local</span></div><p className="settings-copy">You can use Pivot without an account. Your current session is protected by a private browser cookie and your data stays in this local environment.</p><button className="secondary-button full" disabled>Sign in to sync across devices <span>Coming later</span></button></section><section className="settings-section"><div><span className="card-kicker">PRIVACY</span><h2>Control your data</h2></div><p className="settings-copy">Delete your pivots, history, events, and anonymous session whenever you want.</p><button className="danger-button" onClick={deleteData}>Delete all my data</button>{status && <p className="form-status" role="status">{status}</p>}</section><p className="privacy-note"><span>⊙</span> Pivot does not require an account to be useful.</p></div></main>;
}
