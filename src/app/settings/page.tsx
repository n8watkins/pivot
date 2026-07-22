"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { AppShell, type UtilityNavItem } from "@/components/pivot/app-shell";
import { Icon } from "@/components/pivot/ui";

type Pivot = { id: string; goal: string; replacements: { id: string; name: string }[] };
type HistoryEvent = { pivotId?: string };
type AccountInfo = { configured: boolean; authenticated: boolean; user?: { login: string; name?: string | null; image?: string | null } | null };

const utilityNav: UtilityNavItem[] = [
  { kind: "link", label: "Pause space", icon: "home", href: "/" },
  { kind: "link", label: "History", icon: "history", href: "/?screen=history" },
  { kind: "link", label: "Settings", icon: "settings", href: "/settings", active: true },
];

export default function SettingsPage() {
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [pivotCounts, setPivotCounts] = useState<Record<string, number>>({});
  const [contextTags, setContextTags] = useState<string[]>([]);
  const [account, setAccount] = useState<AccountInfo>({ configured: false, authenticated: false });
  const [status, setStatus] = useState("");

  useEffect(() => {
    void fetch("/api/state").then((response) => response.ok ? response.json() : null).then((snapshot: { pivots?: Pivot[]; contextTags?: string[]; history?: HistoryEvent[] } | null) => {
      setPivots(snapshot?.pivots ?? []);
      setContextTags(snapshot?.contextTags ?? []);
      setPivotCounts((snapshot?.history ?? []).reduce<Record<string, number>>((acc, event) => { if (event.pivotId) acc[event.pivotId] = (acc[event.pivotId] ?? 0) + 1; return acc; }, {}));
    }).catch(() => setStatus("Could not load your settings."));
    void fetch("/api/account").then((response) => response.ok ? response.json() : null).then((value: AccountInfo | null) => { if (value) setAccount(value); }).catch(() => undefined);
  }, []);

  async function deleteData() {
    if (!window.confirm(`Delete your pivots, history, and ${account.authenticated ? "connected Pivot account" : "anonymous session"}?`)) return;
    const response = await fetch("/api/session", { method: "DELETE" });
    if (response.ok) { localStorage.removeItem("pivot-state"); if (account.authenticated) await signOut({ redirectTo: "/onboarding" }); else window.location.href = "/onboarding"; }
    else setStatus("Your data could not be deleted. Please try again.");
  }

  async function disconnectAccount() {
    const response = await fetch("/api/account", { method: "POST" });
    if (!response.ok) {
      setStatus("Could not sign out safely. Please try again.");
      return;
    }
    localStorage.removeItem("pivot-state");
    await signOut({ redirectTo: "/" });
  }

  async function removeTag(label: string) {
    const response = await fetch(`/api/tags?label=${encodeURIComponent(label)}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) setContextTags((current) => current.filter((tag) => tag !== label));
    else setStatus("That tag could not be removed.");
  }

  return (
    <AppShell pivots={pivots.map((pivot) => ({ id: pivot.id, goal: pivot.goal }))} activePivotId={null} pivotCounts={pivotCounts} utilityNav={utilityNav}>
      <div className="settings-page">
        <section className="settings-intro">
          <p className="eyebrow">Your space</p>
          <h1>Settings</h1>
          <p className="lede">Keep your pivots clear, private, and shaped around what works for you.</p>
        </section>
        <div className="settings-layout">
          <div className="settings-main-column">
            <section className="settings-section settings-section-featured">
              <div className="settings-section-heading">
                <div><span className="card-kicker">Your pivots</span><h2>What you’re practicing</h2></div>
                <Link className="small-button settings-add" href="/settings/pivots/new">Add pivot <Icon name="plus" size={14} /></Link>
              </div>
              {pivots.length ? <div className="settings-list">{pivots.map((pivot) => <article className="settings-pivot" key={pivot.id}><div><strong>{pivot.goal}</strong><span>{pivot.replacements.length} approved action{pivot.replacements.length === 1 ? "" : "s"}</span></div><Link href={`/settings/pivots/${pivot.id}`} aria-label={`Edit ${pivot.goal}`}>Edit</Link></article>)}</div> : <div className="empty-state">You haven’t created a pivot yet.</div>}
              <Link className="settings-manage-link" href="/settings/pivots">Manage all pivots <Icon name="arrowRight" size={15} /></Link>
            </section>
            <section className="settings-section">
              <div><span className="card-kicker">Context tags</span><h2>Your words for the moment</h2></div>
              <p className="settings-copy">Tags you add during an urge appear here for reuse.</p>
              {contextTags.length ? <div className="goal-list">{contextTags.map((tag) => <span className="goal-pill" key={tag}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)}><Icon name="close" size={14} /></button></span>)}</div> : <div className="empty-state">Custom tags will appear after you add one during an urge.</div>}
            </section>
          </div>
          <aside className="settings-side-column" aria-label="Account and privacy">
            <section className="settings-section">
              <div className="settings-section-heading">
                <div><span className="card-kicker">Account</span><h2>{account.authenticated ? `Signed in as @${account.user?.login}` : "Anonymous by default"}</h2></div>
                <span className="status-dot">{account.authenticated ? "Synced" : "Local"}</span>
              </div>
              <p className="settings-copy">{account.authenticated ? "Your GitHub identity keeps this Pivot account available across devices. Pivot does not request access to your repositories." : "You can keep using Pivot without an account, or connect GitHub to carry this anonymous session to another device."}</p>
              {account.authenticated ? <button type="button" className="secondary-button full" onClick={disconnectAccount}>Sign out <Icon name="arrowRight" size={18} /></button> : <button type="button" className="secondary-button full" disabled={!account.configured} onClick={() => signIn("github", { redirectTo: "/settings" })}>{account.configured ? "Continue with GitHub" : "GitHub sign-in needs configuration"} <Icon name="arrowRight" size={18} /></button>}
            </section>
            <section className="settings-section">
              <div><span className="card-kicker">Your data</span><h2>Export or delete</h2></div>
              <p className="settings-copy">Download a readable JSON copy of your pivots, tags, History, and active action. One-time context notes are never included because Pivot does not store them.</p>
              <a className="secondary-button full" href="/api/export" download>Download my data <Icon name="download" size={18} /></a>
              <button type="button" className="danger-button" onClick={deleteData}>Delete all my data</button>
              {status && <p className="form-status" role="status">{status}</p>}
            </section>
          </aside>
        </div>
        <p className="privacy-note"><span className="privacy-ic"><Icon name="shield" size={15} /></span> Pivot does not require an account to be useful.</p>
      </div>
    </AppShell>
  );
}
