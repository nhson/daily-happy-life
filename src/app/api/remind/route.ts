import { db } from "@/data/db/client";
import { qstashReceiver, qstashScheduler, webPusher } from "@/data/push-services";
import { sendReminder } from "@/data/reminders";

/** QStash → the day's reminder for one user (ADR 0001). Signed by QStash; nothing else may call it. */
export async function POST(request: Request) {
  const receiver = qstashReceiver();
  const pusher = webPusher();
  const scheduler = qstashScheduler();
  if (!receiver || !pusher || !scheduler) return Response.json({ error: "reminders not configured" }, { status: 503 });

  const body = await request.text();
  const signature = request.headers.get("upstash-signature") ?? "";
  const valid = await receiver.verify({ signature, body }).catch(() => false);
  if (!valid) return Response.json({ error: "bad signature" }, { status: 401 });

  const { userId } = JSON.parse(body) as { userId?: unknown };
  if (typeof userId !== "string") return Response.json({ error: "no user" }, { status: 400 });
  const result = await sendReminder(db, userId, pusher, scheduler, new Date());
  return Response.json({ result });
}
