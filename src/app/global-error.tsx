"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/error-reporting";

// Shown only when the root layout itself fails, so it carries its own markup and styles.
// The crisis lines are plain links and text: they work even if nothing else on the page does.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error), [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Arial, sans-serif", background: "#f5f7f2", color: "#26302b" }}>
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px" }}>
          <h1 style={{ fontSize: 28, lineHeight: 1.2 }}>Pivot could not load.</h1>
          <p>Your saved data is still in place.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid #4d6d5a", background: "#4d6d5a", color: "#fff", fontWeight: 600 }}>Try again</button>
          <p style={{ marginTop: 32 }}>In crisis? In the US, call or text <a href="tel:988">988</a> (Suicide &amp; Crisis Lifeline), or text HOME to 741741. If you are in immediate danger, call <a href="tel:911">911</a>. Elsewhere, find a helpline at <a href="https://findahelpline.com">findahelpline.com</a>. <a href="/help">All crisis lines</a>.</p>
        </main>
      </body>
    </html>
  );
}
