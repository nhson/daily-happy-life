import { FirstRun } from "@/features/onboarding/first-run";

// Phase 0 is client-only; see (app)/layout.tsx.
export const instant = false;

export default function Page() {
  return <FirstRun />;
}
