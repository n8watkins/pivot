import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, Logo } from "@/components/pivot/ui";

export const LEGAL_UPDATED = "November 4, 2026";

export function LegalPage({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede: string; children: ReactNode }) {
  return (
    <main className="app-shell">
      <div className="legal-wrap">
        <div className="setup-top">
          <Link className="brand" href="/"><Logo /><span>pivot</span></Link>
          <Link className="legal-back" href="/">Back to Pivot <Icon name="arrowRight" size={15} /></Link>
        </div>
        <header className="legal-intro">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="lede">{lede}</p>
          <p className="legal-updated">Last updated {LEGAL_UPDATED}.</p>
        </header>
        <div className="legal-body">{children}</div>
        <SafetyFooter />
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Legal">
      <Link href="/privacy">Privacy</Link>
      <span aria-hidden="true">·</span>
      <Link href="/terms">Terms</Link>
    </nav>
  );
}

/** Shown on every screen: Pivot is not care or an emergency service, where to get help, and the legal links. */
export function SafetyFooter() {
  return (
    <footer className="safety-footer">
      <span className="footer-mark"><Logo size={20} label="Pivot" /></span>
      <p>
        Pivot is a habit tool, not medical care, therapy, or an emergency service.
        In crisis? In the US, call or text <a href="tel:988">988</a>; elsewhere, find a helpline at <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a>.
        {" "}<a href="/help">All crisis lines</a>.
      </p>
      <LegalLinks />
    </footer>
  );
}
