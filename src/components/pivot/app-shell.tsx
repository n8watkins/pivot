"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, Logo, type IconName } from "@/components/pivot/ui";

export type PivotSummary = { id: string; goal: string };

export type UtilityNavItem =
  | { kind: "link"; label: string; href: string; icon: IconName; active?: boolean }
  | { kind: "action"; label: string; icon: IconName; onClick: () => void; active?: boolean };

type AccountInfo = { authenticated: boolean; user?: { login?: string | null } | null } | null;

export function AppShell({
  pivots,
  activePivotId,
  onSelectPivot,
  pivotCounts,
  pivotSelectionDisabled = false,
  newPivotHref = "/settings/pivots/new",
  utilityNav,
  focusMode = false,
  focusLabel,
  rightRail,
  children,
}: {
  pivots: PivotSummary[];
  activePivotId?: string | null;
  onSelectPivot?: (id: string) => void;
  pivotCounts?: Record<string, number>;
  pivotSelectionDisabled?: boolean;
  newPivotHref?: string;
  utilityNav: UtilityNavItem[];
  focusMode?: boolean;
  focusLabel?: string;
  rightRail?: ReactNode;
  children: ReactNode;
}) {
  const [account, setAccount] = useState<AccountInfo>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/account")
      .then((response) => (response.ok ? response.json() : null))
      .then((value: AccountInfo) => { if (!cancelled && value) setAccount(value); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  if (focusMode) {
    return (
      <main className="app-shell">
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <div className="focus-frame">
          <div className="focus-topbar">
            <span className="brand"><Logo /><span>pivot</span></span>
            {focusLabel && <span className="focus-mode-label">{focusLabel}</span>}
          </div>
          <div className="focus-content" id="main-content" tabIndex={-1}>{children}</div>
        </div>
      </main>
    );
  }

  const login = account?.user?.login ?? null;
  const authed = Boolean(account?.authenticated && login);

  function renderPivotButton(pivot: PivotSummary, className: string, withMeta: boolean) {
    const on = pivot.id === activePivotId;
    const count = pivotCounts?.[pivot.id];
    const inner = (
      <>
        {withMeta && <span className="pv-dot" aria-hidden="true" />}
        <span className="pv-name">{pivot.goal}</span>
        {withMeta && typeof count === "number" && <span className="pv-count" aria-hidden="true">{count}</span>}
      </>
    );
    if (onSelectPivot) {
      return (
        <button type="button" key={pivot.id} className={`${className} ${on ? "on" : ""}`} aria-current={on ? "true" : undefined} disabled={pivotSelectionDisabled} onClick={() => onSelectPivot(pivot.id)}>
          {inner}
        </button>
      );
    }
    return (
      <Link key={pivot.id} className={`${className} ${on ? "on" : ""}`} href={`/?pivot=${encodeURIComponent(pivot.id)}`}>
        {inner}
      </Link>
    );
  }

  function renderUtil(item: UtilityNavItem, className: string) {
    const icon = <Icon name={item.icon} size={18} />;
    if (item.kind === "link") {
      return <Link key={item.label} className={`${className} ${item.active ? "on" : ""}`} aria-current={item.active ? "page" : undefined} href={item.href}>{icon}<span>{item.label}</span></Link>;
    }
    return (
      <button type="button" key={item.label} className={`${className} ${item.active ? "on" : ""}`} aria-current={item.active ? "true" : undefined} onClick={item.onClick}>
        {icon}<span>{item.label}</span>
      </button>
    );
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className={`shell ${rightRail ? "has-rail" : ""}`}>
        <aside className="shell-sidebar">
          <Link className="brand shell-brand" href="/"><Logo /><span>pivot</span></Link>

          <div className="shell-pivots">
            <span className="shell-section-label">Your pivots</span>
            {pivots.length > 0 && <div className="pivot-rail">{pivots.map((pivot) => renderPivotButton(pivot, "pivot-rail-item", true))}</div>}
            <Link className="pivot-rail-add" href={newPivotHref}><Icon name="plus" size={15} /><span>New pivot</span></Link>
          </div>

          <nav className="shell-util" aria-label="Main navigation">
            {utilityNav.map((item) => renderUtil(item, "shell-util-item"))}
          </nav>

          <Link className="shell-account" href="/settings" aria-label="Account and settings">
            <span className="shell-account-av" aria-hidden="true"><Icon name="account" size={17} /></span>
            <span className="shell-account-who">
              <strong>{authed ? `@${login}` : "You"}</strong>
              <span>{authed ? "Synced across devices" : "Anonymous"}</span>
            </span>
            <span className="shell-account-badge">{authed ? "SYNCED" : "LOCAL"}</span>
          </Link>
        </aside>

        <div className="shell-body">
          <header className="shell-mobtop">
            <Link className="brand" href="/"><Logo /><span>pivot</span></Link>
          </header>
          {pivots.length > 0 && (
            <div className="pivot-pillbar" aria-label="Choose a pivot">
              {pivots.map((pivot) => renderPivotButton(pivot, "pivot-pill", false))}
              <Link className="pivot-pill pivot-pill-add" href={newPivotHref}><Icon name="plus" size={14} /> New</Link>
            </div>
          )}
          <div className="shell-content" id="main-content" tabIndex={-1}>{children}</div>
        </div>

        {rightRail && <aside className="shell-rail">{rightRail}</aside>}

        <nav className="shell-tabbar" aria-label="Mobile navigation">
          {utilityNav.map((item) => renderUtil(item, "shell-tab"))}
        </nav>
      </div>
    </main>
  );
}
