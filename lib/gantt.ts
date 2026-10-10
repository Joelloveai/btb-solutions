const DAY = 24 * 60 * 60 * 1000;

export type GanttTask = {
  id: string;
  text: string;
  start_date: string; // YYYY-MM-DD
  duration: number; // days, at least 1
  progress: number; // 0 or 1
  type: "task" | "milestone";
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Map project tasks onto Gantt bars. A task with a start date spans start..due (inclusive).
 * Without one it is a single-day bar on its due date, and a milestone is a marker on its due date.
 */
export function toGanttTasks(
  tasks: { id: string; description: string; startDate: Date | null; dueDate: Date; isMilestone: boolean; status: string }[],
): GanttTask[] {
  return tasks.map((t) => {
    // A milestone is a single point on its due date, whatever else is stored.
    const start = !t.isMilestone && t.startDate && t.startDate <= t.dueDate ? t.startDate : t.dueDate;
    const duration = t.isMilestone ? 0 : Math.max(1, Math.round((t.dueDate.getTime() - start.getTime()) / DAY) + 1);
    return {
      id: t.id,
      text: t.description,
      start_date: ymd(start),
      duration,
      progress: t.status === "DONE" ? 1 : 0,
      type: t.isMilestone ? "milestone" : "task",
    };
  });
}

/** Share of the project's tasks that are done, as a whole percent; null when there are no tasks. */
export function completionPercent(tasks: { status: string }[]): number | null {
  if (tasks.length === 0) return null;
  return Math.round((tasks.filter((t) => t.status === "DONE").length / tasks.length) * 100);
}
