import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-shell">
      <div className="setup-wrap">
        <p className="eyebrow">Page not found</p>
        <h1>This path does not lead to a pivot.</h1>
        <p className="lede">Return to your pause space or open Settings to manage your pivots.</p>
        <Link className="primary-button full" href="/">Return home</Link>
        <Link className="quiet-button" href="/settings">Open Settings</Link>
      </div>
    </main>
  );
}
