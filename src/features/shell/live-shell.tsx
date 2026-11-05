import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { db } from "@/data/db/client";
import { loadLive } from "@/data/live";
import { ensureUser } from "@/data/users";
import { AppShell } from "./app-shell";

/**
 * The signed-in user's data, read on the server and handed to the client shell. The user row is
 * created on first sign-in (first timezone guess: Vercel's IP-based header). Signed out only
 * happens in design review (`dev:review`), which runs on sample data.
 */
export async function LiveShell({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  if (!userId) return <AppShell live={null}>{children}</AppShell>;
  const user = await ensureUser(db, userId, (await headers()).get("x-vercel-ip-timezone"));
  return <AppShell live={await loadLive(db, user)}>{children}</AppShell>;
}
