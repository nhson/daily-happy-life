import { LifeView } from "@/features/life/life-view";

// The shell renders client-only; see (app)/layout.tsx.
export const instant = false;

export default function Page() {
  return <LifeView />;
}
