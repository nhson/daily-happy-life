import { AppShell } from "@/features/shell/app-shell";

/**
 * Phase 0 renders client-only (mock store lives in the browser), so pages can't be prerendered.
 * Slice 1 moves data to the server and should remove this to restore instant-navigation checks.
 */
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
