"use client";

import { useState, useSyncExternalStore } from "react";
import { usePwaInstall } from "@/components/pivot/pwa-manager";

// The install hint on /welcome. Chrome and Edge (Android and desktop) get a real Install button
// from beforeinstallprompt; iPhone and iPad Safari get the Share > Add to Home Screen steps; other
// browsers get short manual steps; an installed app sees a confirmation. `?platform=ios` forces
// the iOS steps for previews and screenshots.

type Platform = "ios" | "ios-other" | "other";

function detectPlatform(): Platform {
  if (new URLSearchParams(location.search).get("platform") === "ios") return "ios";
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!iOS) return "other";
  // Only Safari can add to the Home Screen on older iOS; other iOS browsers point to Safari.
  return /CriOS|FxiOS|EdgiOS/.test(ua) ? "ios-other" : "ios";
}

const noSubscribe = () => () => {};

export function WelcomeInstall() {
  const { installState, promptInstall } = usePwaInstall();
  const platform = useSyncExternalStore(noSubscribe, detectPlatform, () => "other" as Platform);
  const [status, setStatus] = useState("");

  async function install() {
    const accepted = await promptInstall();
    setStatus(accepted ? "Pivot is on your home screen now." : "Pivot was not installed. You can add it any time.");
  }

  let body;
  if (installState === "installed") {
    body = <p className="welcome-install-done">Pivot is installed on this device.</p>;
  } else if (platform === "ios" || platform === "ios-other") {
    body = (
      <>
        {platform === "ios-other" && <p className="welcome-install-note">Open this page in Safari to add Pivot to your Home Screen.</p>}
        <ol className="welcome-install-steps">
          <li><span aria-hidden="true">1</span><p>Tap <strong>Share</strong> in Safari&apos;s toolbar.</p></li>
          <li><span aria-hidden="true">2</span><p>Choose <strong>Add to Home Screen</strong>.</p></li>
          <li><span aria-hidden="true">3</span><p>Open Pivot from your Home Screen.</p></li>
        </ol>
        <p className="welcome-install-note">Check-in notifications on iPhone need iOS 16.4 or later.</p>
      </>
    );
  } else if (installState === "available") {
    body = <button type="button" className="primary-button" onClick={install}>Install Pivot</button>;
  } else {
    body = (
      <ol className="welcome-install-steps">
        <li><span aria-hidden="true">1</span><p>Open Pivot in Chrome or Edge.</p></li>
        <li><span aria-hidden="true">2</span><p>Open the browser menu.</p></li>
        <li><span aria-hidden="true">3</span><p>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p></li>
      </ol>
    );
  }

  return (
    <div className="welcome-install-card">
      {/* The real home screen icon, so people recognize it after installing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/pivot-192.png" alt="" width={56} height={56} />
      <div className="welcome-install-body">
        <h3>Add Pivot to your phone</h3>
        {body}
        {status && <p className="welcome-install-note" role="status">{status}</p>}
      </div>
    </div>
  );
}
