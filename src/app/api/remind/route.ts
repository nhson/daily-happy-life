import { db } from "@/data/db/client";
import { qstashReceiver, qstashScheduler, webPusher } from "@/data/push-services";
import { sendFocusEnd } from "@/data/focus";
import { sendReminder } from "@/data/reminders";

/**
 * QStash → the day's reminder for one user (ADR 0001), or the end of one Focus Session (`focusId`).
 * Signed by QStash; nothing else may call it.
 */
export async function POST(request: Request) {
  const receiver = qstashReceiver();
  const pusher = webPusher();
  const scheduler = qstashScheduler();
  if (!receiver || !pusher || !scheduler) return Response.json({ error: "reminders not configured" }, { status: 503 });

  const body = await request.text();
  const signature = request.headers.get("upstash-signature") ?? "";
  const valid = await receiver.verify({ signature, body }).catch(() => false);
  if (!valid) return Response.json({ error: "bad signature" }, { status: 401 });

  const { userId, focusId } = JSON.parse(body) as { userId?: unknown; focusId?: unknown };
  if (typeof userId !== "string") return Response.json({ error: "no user" }, { status: 400 });
  if (typeof focusId === "string") return Response.json({ result: await sendFocusEnd(db, userId, focusId, pusher, new Date()) });
  const result = await sendReminder(db, userId, pusher, scheduler, new Date());
  return Response.json({ result });
}
