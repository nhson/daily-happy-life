import { Suspense } from "react";
import { EnsureUser } from "@/features/auth/ensure-user";
import { AppShell } from "@/features/shell/app-shell";

/**
 * The app shell still renders client-only (the mock store lives in the browser until Slice 3),
 * so Next can't validate the pages below it. Remove with the mock store, not before.
 */
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense>
        <EnsureUser />
      </Suspense>
      <AppShell>{children}</AppShell>
    </>
  );
}
