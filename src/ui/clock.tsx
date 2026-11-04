"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The app's sense of "now". `?at=HH:MM` pins the time of day for design review,
 * so every sky state and ritual mode can be inspected on demand.
 */
interface Clock {
  now: Date;
  /** "HH:MM" when pinned via ?at=, else null. */
  pinned: string | null;
}

const ClockContext = createContext<Clock | null>(null);

function read(pinned: string | null): Date {
  const d = new Date();
  if (pinned) {
    const [h, m] = pinned.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

export function ClockProvider({ children }: { children: ReactNode }) {
  const [pinned] = useState<string | null>(() => {
    const at = new URLSearchParams(window.location.search).get("at");
    return at && /^\d{1,2}:\d{2}$/.test(at) ? at : null;
  });
  const [now, setNow] = useState(() => read(pinned));

  useEffect(() => {
    const id = setInterval(() => setNow(read(pinned)), 30_000);
    const onVisible = () => document.visibilityState === "visible" && setNow(read(pinned));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pinned]);

  return <ClockContext value={{ now, pinned }}>{children}</ClockContext>;
}

export function useClock(): Clock {
  const c = useContext(ClockContext);
  if (!c) throw new Error("useClock outside ClockProvider");
  return c;
}
