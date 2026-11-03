import Link from "next/link";
import { Logo } from "@/components/pivot/ui";

export default function OfflinePage() {
  return (
    <main className="offline-page" id="main-content">
      <span className="brand"><Logo /><span>pivot</span></span>
      <div className="offline-card">
        <p className="eyebrow">You are offline</p>
        <h1>Pivot will be here when your connection returns.</h1>
        <p className="lede">Previously loaded screens may still be available. Pivot never caches your account data, notes, or check-in history.</p>
        <Link className="primary-button" href="/">Try again</Link>
      </div>
    </main>
  );
}
