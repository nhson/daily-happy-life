import { SettingsView } from "@/features/settings/settings-view";

// Phase 0 is client-only; see (app)/layout.tsx.
export const instant = false;

export default function Page() {
  return <SettingsView />;
}
