"use client";

import { useEffect, useState } from "react";
import type { NotificationCadence } from "@/lib/notifications";
import { subscribeCurrentBrowser, supportsWebPush, unsubscribeCurrentPushSubscription } from "@/lib/push-client";

type PreferenceResponse = {
  cadence: NotificationCadence;
  timezone: string;
  available: boolean;
  publicKey: string;
};

const cadenceOptions: { value: NotificationCadence; label: string; detail: string }[] = [
  { value: "off", label: "Off", detail: "No check-in notifications." },
  { value: "weekly", label: "Weekly", detail: "Mondays around 9 AM in your timezone." },
  { value: "monthly", label: "Monthly", detail: "The first day of each month around 9 AM." },
];

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function NotificationSettings() {
  const [preference, setPreference] = useState<PreferenceResponse | null>(null);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    void fetch("/api/notifications/preferences", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<PreferenceResponse> : Promise.reject(new Error("Could not load notification settings.")))
      .then((value) => { setSupported(supportsWebPush()); setPreference(value); })
      .catch(() => { setSupported(supportsWebPush()); setIsError(true); setStatus("Could not load notification settings."); });
  }, []);

  async function savePreference(cadence: NotificationCadence) {
    if (!preference || busy || cadence === preference.cadence) return;
    setBusy(true);
    setStatus("");
    setIsError(false);
    const timezone = browserTimeZone();
    try {
      if (cadence === "off") {
        const response = await fetch("/api/notifications/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cadence, timezone }),
        });
        if (!response.ok) throw new Error("Could not turn notifications off.");
        await unsubscribeCurrentPushSubscription({ notifyServer: false });
        setPreference({ ...preference, cadence, timezone });
        setStatus("Notifications are off.");
        return;
      }

      if (!supported || !preference.available || !preference.publicKey) throw new Error("Notifications are not available in this browser yet.");
      if (Notification.permission === "denied") throw new Error("Notifications are blocked in your browser settings. Pivot will keep them off.");
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted. Pivot will keep them off.");

      const previousCadence = preference.cadence;
      const subscription = await subscribeCurrentBrowser(preference.publicKey);
      const subscriptionResponse = await fetch("/api/notifications/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!subscriptionResponse.ok) throw new Error("Could not save this device for notifications.");
      const preferenceResponse = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence, timezone }),
      });
      if (!preferenceResponse.ok) {
        if (previousCadence === "off") await unsubscribeCurrentPushSubscription();
        throw new Error("Could not save your notification schedule.");
      }
      setPreference({ ...preference, cadence, timezone });
      setStatus(`${cadence === "weekly" ? "Weekly" : "Monthly"} check-ins are on.`);
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : "Notification settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section notification-section">
      <div><span className="card-kicker">Check-ins</span><h2>Notifications</h2></div>
      <p className="settings-copy">Choose a quiet weekly or monthly prompt. Notifications are off until you opt in.</p>
      <fieldset className="notification-options" disabled={!preference || busy}>
        <legend className="sr-only">Notification frequency</legend>
        {cadenceOptions.map((option) => {
          const unavailable = option.value !== "off" && (!supported || preference?.available === false);
          return (
            <label className={`${preference?.cadence === option.value ? "selected" : ""} ${unavailable ? "unavailable" : ""}`} key={option.value}>
              <input type="radio" name="notification-cadence" value={option.value} checked={preference?.cadence === option.value} disabled={busy || unavailable} onChange={() => void savePreference(option.value)} />
              <span><strong>{option.label}</strong><small>{option.detail}</small></span>
            </label>
          );
        })}
      </fieldset>
      <p className="notification-privacy">Messages only say “Your Pivot check-in is ready.” Habit names, urge context, and notes are never included.</p>
      {!supported && <p className="hint">Install Pivot with Chrome on Android to use check-in notifications.</p>}
      {status && <p className={isError ? "form-status" : "success-status"} role="status">{status}</p>}
    </section>
  );
}
