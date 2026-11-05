import { Suspense } from "react";
import { ShellPlaceholder } from "@/features/shell/app-shell";
import { LiveShell } from "@/features/shell/live-shell";

/**
 * The app shell still renders client-only (the sample parts of the store live in the browser
 * until Slice 3), so Next can't validate the pages below it. Remove with the mock store.
 */
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellPlaceholder />}>
      <LiveShell>{children}</LiveShell>
    </Suspense>
  );
}
