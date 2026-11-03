"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Pivot route error", { digest: error.digest, name: error.name });
  }, [error]);

  return (
    <main className="app-shell">
      <div className="setup-wrap">
        <p className="eyebrow">Something interrupted this step</p>
        <h1>Pivot could not finish loading.</h1>
        <p className="lede">Your saved data is still in place. Try the page again or return to your pause space.</p>
        <button type="button" className="primary-button full" onClick={reset}>Try again</button>
        <Link className="quiet-button" href="/">Return home</Link>
      </div>
    </main>
  );
}
