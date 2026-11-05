import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/data/db/client";
import * as schema from "@/data/db/schema";
import { exportAll } from "@/data/export";

/** Settings → Export all: every table the signed-in user owns, as one JSON download. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response(null, { status: 401 });
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.clerkId, userId));
  if (!user) return new Response(null, { status: 404 });
  const data = await exportAll(db, user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="daily-happy-life-${data.exportedAt.slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
