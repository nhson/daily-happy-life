import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { db } from "@/data/db/client";
import { ensureUser } from "@/data/users";

/**
 * Creates the user row on first sign-in (idempotent afterwards). Renders nothing; sits behind
 * Suspense because it reads the request. First timezone guess: Vercel's IP-based header.
 */
export async function EnsureUser() {
  const { userId } = await auth();
  if (!userId) return null;
  const tz = (await headers()).get("x-vercel-ip-timezone");
  await ensureUser(db, userId, tz);
  return null;
}
