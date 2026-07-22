"use client";

function urlBase64ToBytes(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = window.atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function supportsWebPush() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export async function subscribeCurrentBrowser(publicKey: string) {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ?? registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) });
}

export async function unsubscribeCurrentPushSubscription({ notifyServer = true }: { notifyServer?: boolean } = {}) {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return false;
  if (notifyServer) {
    const response = await fetch("/api/notifications/subscription", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    if (!response.ok) throw new Error("Push subscription could not be removed from Pivot.");
  }
  await subscription.unsubscribe();
  return true;
}
