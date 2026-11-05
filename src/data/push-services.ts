import "server-only";
import { Client, Receiver } from "@upstash/qstash";
import webpush from "web-push";
import type { Pusher, Scheduler } from "./reminders";

/**
 * The real services behind `Scheduler` and `Pusher`. Each is null until its environment is set
 * (QSTASH_*, VAPID_*), so the app runs — reminders off — without them.
 */

/** Where QStash calls back: APP_URL, or the production URL Vercel provides. */
export function appUrl(): string | null {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  return process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null;
}

export function qstashScheduler(): Scheduler | null {
  const token = process.env.QSTASH_TOKEN;
  const base = appUrl();
  if (!token || !base) return null;
  const client = new Client({ token, baseUrl: process.env.QSTASH_URL });
  return {
    async upsert(id, cron, body) {
      await client.schedules.create({
        scheduleId: id,
        destination: `${base}/api/remind`,
        cron,
        body,
        headers: { "content-type": "application/json" },
        retries: 2,
      });
    },
    async remove(id) {
      try {
        await client.schedules.delete(id);
      } catch (e) {
        if (!String(e).includes("404") && !String(e).toLowerCase().includes("not found")) throw e;
      }
    },
  };
}

export function webPusher(): Pusher | null {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const base = appUrl();
  if (!pub || !priv || !base) return null;
  webpush.setVapidDetails(base, pub, priv);
  return {
    async send(sub, payload) {
      try {
        await webpush.sendNotification(sub, payload, { TTL: 60 * 60, urgency: "normal" });
        return "sent";
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return "gone";
        throw e;
      }
    },
  };
}

/** Only QStash may call `/api/remind`. */
export function qstashReceiver(): Receiver | null {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  return current && next ? new Receiver({ currentSigningKey: current, nextSigningKey: next }) : null;
}
