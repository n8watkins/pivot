"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const SERVICE_WORKER_URL = "/sw.js?v=2026-07-22-1";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type InstallState = "checking" | "installed" | "available" | "manual";

type PwaContextValue = {
  installState: InstallState;
  promptInstall: () => Promise<boolean>;
};

const PwaContext = createContext<PwaContextValue | null>(null);

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>("checking");
  const [updateRegistration, setUpdateRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const syncInstallState = () => setInstallState(isStandalone() ? "installed" : installPrompt ? "available" : "manual");
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallState(isStandalone() ? "installed" : "available");
    };
    const markInstalled = () => {
      setInstallPrompt(null);
      setInstallState("installed");
    };

    syncInstallState();
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    media.addEventListener("change", syncInstallState);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
      media.removeEventListener("change", syncInstallState);
    };
  }, [installPrompt]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const watchInstallingWorker = () => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller && registration?.waiting) setUpdateRegistration(registration);
      });
    };

    void navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
      .then((value) => {
        if (disposed) return;
        registration = value;
        if (registration.waiting && navigator.serviceWorker.controller) setUpdateRegistration(registration);
        registration.addEventListener("updatefound", watchInstallingWorker);
        void registration.update().catch(() => undefined);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      registration?.removeEventListener("updatefound", watchInstallingWorker);
    };
  }, []);

  const value = useMemo<PwaContextValue>(() => ({
    installState,
    async promptInstall() {
      if (!installPrompt) return false;
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
        setInstallState("installed");
        return true;
      }
      return false;
    },
  }), [installPrompt, installState]);

  function activateUpdate() {
    const waiting = updateRegistration?.waiting;
    if (!waiting) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <PwaContext.Provider value={value}>
      {children}
      {updateRegistration && (
        <aside className="pwa-update" aria-label="Pivot update available">
          <div><strong>A fresh version of Pivot is ready.</strong><span>Your current work is safe.</span></div>
          <button type="button" onClick={activateUpdate}>Update</button>
          <button type="button" className="pwa-update-dismiss" aria-label="Dismiss update" onClick={() => setUpdateRegistration(null)}>Later</button>
        </aside>
      )}
    </PwaContext.Provider>
  );
}

export function usePwaInstall() {
  const value = useContext(PwaContext);
  if (!value) throw new Error("usePwaInstall must be used inside PwaProvider");
  return value;
}
