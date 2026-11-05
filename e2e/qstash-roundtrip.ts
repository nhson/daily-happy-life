// `bun run check:qstash` — a live QStash → production /api/remind round trip for the E2E test user (never the owner).
import { Client } from "@upstash/qstash";
import { e2eUserId } from "./support";

const base = "https://daily-happy-life.vercel.app";
const client = new Client({ token: process.env.QSTASH_TOKEN!, baseUrl: process.env.QSTASH_URL });
const userId = await e2eUserId();

// 1. Scheduler: create and delete a schedule, the way syncReminder does.
const sid = `remind-e2e-probe`;
await client.schedules.create({ scheduleId: sid, destination: `${base}/api/remind`, cron: "0 3 1 1 *", body: JSON.stringify({ userId }) });
const got = await client.schedules.get(sid);
console.log("schedule created:", got.scheduleId, got.cron);
await client.schedules.delete(sid);
console.log("schedule deleted");

// 2. Signed delivery: QStash calls production; the route verifies the signature and answers.
const { messageId } = await client.publishJSON({ url: `${base}/api/remind`, body: { userId }, retries: 0 });
console.log("published", messageId);
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const logs = await client.logs({ filter: { messageId } });
  const done = logs.logs.find((l) => ["DELIVERED", "FAILED", "ERROR"].includes(l.state));
  if (done) {
    console.log("state:", done.state, "status:", (done as Record<string, unknown>).responseStatus);
    break;
  }
}
