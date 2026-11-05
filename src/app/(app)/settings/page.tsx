import { SettingsView } from "@/features/settings/settings-view";

// The shell renders client-only; see (app)/layout.tsx.
export const instant = false;

export default function Page() {
  return <SettingsView />;
}
