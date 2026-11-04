import { LifeView } from "@/features/life/life-view";

// Phase 0 is client-only; see (app)/layout.tsx.
export const instant = false;

export default function Page() {
  return <LifeView />;
}
