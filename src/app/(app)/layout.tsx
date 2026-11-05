import { Suspense } from "react";
import { ShellPlaceholder } from "@/features/shell/app-shell";
import { LiveShell } from "@/features/shell/live-shell";

/**
 * The app shell renders client-only: the sky, the ritual mode and the Logical Day all follow the
 * device clock, which the server can't know. So Next can't validate the pages below it; this
 * opt-out stays until the shell renders on the server (see PLAN.md, Slice 3 decisions).
 */
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellPlaceholder />}>
      <LiveShell>{children}</LiveShell>
    </Suspense>
  );
}
