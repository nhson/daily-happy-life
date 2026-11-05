import { TasksPanel } from "@/features/tasks/tasks-panel";

// The shell renders client-only; see (app)/layout.tsx.
export const instant = false;

export default function TasksPage() {
  return (
    <div className="mx-auto max-w-2xl pt-4">
      <TasksPanel />
    </div>
  );
}
