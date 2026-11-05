"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { savePushAction } from "@/data/actions";

/**
 * The installable app: service worker registration, the reminder's push subscription on this
 * device, and the install prompt where the browser offers one (not iOS: there it is Share → Add
 * to Home Screen).
 */

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** Registers /sw.js in production builds only (dev and design review stay cache-free). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

export type PushStatus = "loading" | "unsupported" | "unavailable" | "denied" | "off" | "on";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Reminder push on this device. */
export function usePush() {
  const [status, setStatus] = useState<PushStatus>("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setStatus("unsupported");
      if (!VAPID) return setStatus("unavailable");
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (live) setStatus(sub ? "on" : "off");
    })();
    return () => {
      live = false;
    };
  }, []);

  const enable = useCallback(async () => {
    if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return setStatus("denied");
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }));
    const r = await savePushAction(sub.toJSON() as never);
    if (!r.ok) {
      await sub.unsubscribe();
      return setStatus("unavailable");
    }
    setStatus("on");
  }, []);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
    await savePushAction(null);
    setStatus("off");
  }, []);

  return { status, enable, disable };
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

/** The browser's own install prompt, when it offers one. */
export function useInstall(): (() => Promise<void>) | null {
  const available = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => deferred !== null,
    () => false,
  );
  if (!available) return null;
  return async () => {
    const e = deferred;
    deferred = null;
    listeners.forEach((l) => l());
    await e?.prompt();
  };
}
