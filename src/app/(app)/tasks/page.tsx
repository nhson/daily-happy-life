import { TasksPanel } from "@/features/tasks/tasks-panel";

// Phase 0 is client-only; see (app)/layout.tsx.
export const instant = false;

export default function TasksPage() {
  return (
    <div className="mx-auto max-w-2xl pt-4">
      <TasksPanel />
    </div>
  );
}
