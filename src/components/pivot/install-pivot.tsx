"use client";

import { useState } from "react";
import { Icon } from "@/components/pivot/ui";
import { usePwaInstall } from "@/components/pivot/pwa-manager";

export function InstallPivot() {
  const { installState, promptInstall } = usePwaInstall();
  const [showInstructions, setShowInstructions] = useState(false);
  const [status, setStatus] = useState("");

  if (installState === "checking" || installState === "installed") return null;

  async function install() {
    if (installState === "manual") {
      setShowInstructions((current) => !current);
      return;
    }
    const accepted = await promptInstall();
    setStatus(accepted ? "Pivot was added to your device." : "Installation was not completed.");
  }

  return (
    <section className="settings-section install-section">
      <div><span className="card-kicker">On your device</span><h2>Install Pivot</h2></div>
      <p className="settings-copy">Add Pivot to your home screen for a focused, full-screen experience with quick launcher access.</p>
      <button type="button" className="secondary-button full" aria-expanded={installState === "manual" ? showInstructions : undefined} onClick={install}>
        Install Pivot <Icon name="download" size={18} />
      </button>
      {installState === "manual" && showInstructions && (
        <div className="install-instructions">
          <strong>Install from Chrome</strong>
          <ol>
            <li>Open Pivot in Chrome on Android.</li>
            <li>Open the Chrome menu.</li>
            <li>Choose <span>Add to Home screen</span> or <span>Install app</span>.</li>
          </ol>
        </div>
      )}
      {status && <p className={status.includes("added") ? "success-status" : "form-status"} role="status">{status}</p>}
    </section>
  );
}
