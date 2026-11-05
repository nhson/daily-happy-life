import { TodayView } from "@/features/today/today-view";

// The shell renders client-only; see (app)/layout.tsx.
export const instant = false;

export default function TodayPage() {
  return <TodayView />;
}
