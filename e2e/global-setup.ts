import { clerkSetup } from "@clerk/testing/playwright";
import { E2E_EMAIL, clerkApi, sql } from "./support";

/**
 * A clean test user every run: its app rows are wiped (cascade) each time.
 * The first run creates it in Clerk. Sign-up is owner-only (allowlist), so the alias is allowed
 * just long enough to create the user and removed again: the gate never stays wider.
 */
export default async function globalSetup() {
  await clerkSetup();
  const api = clerkApi();
  let [user] = (await api.users.getUserList({ emailAddress: [E2E_EMAIL] })).data;
  if (!user) {
    const entry = await api.allowlistIdentifiers.createAllowlistIdentifier({ identifier: E2E_EMAIL, notify: false });
    try {
      user = await api.users.createUser({ emailAddress: [E2E_EMAIL], skipPasswordRequirement: true });
    } finally {
      await api.allowlistIdentifiers.deleteAllowlistIdentifier(entry.id);
    }
  }
  await sql()`delete from users where clerk_id = ${user.id}`;
}
