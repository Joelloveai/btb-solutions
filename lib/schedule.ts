const DAY = 24 * 60 * 60 * 1000;

export type DueBucket = "overdue" | "today" | "week" | "later";

export const BUCKET_LABELS: Record<DueBucket, string> = { overdue: "Overdue", today: "Due today", week: "This week", later: "Later" };
export const BUCKET_ORDER: DueBucket[] = ["overdue", "today", "week", "later"];

/**
 * Where a due date falls relative to today (both are calendar dates held at UTC midnight):
 * before today is overdue; "this week" means the next six days after today.
 */
export function dueBucket(due: Date, today: Date): DueBucket {
  const days = Math.round((due.getTime() - today.getTime()) / DAY);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 6) return "week";
  return "later";
}

export type DailySummary = { newTasks: number; dueTomorrow: number; overdue: number; newPunch: number };

/** The numbers in the subcontractor's "today" card. "New" means assigned in the last 24 hours. */
export function dailySummary(
  tasks: { status: string; createdAt: Date; dueDate: Date }[],
  punch: { status: string; createdAt: Date; dueDate: Date | null }[],
  now: Date,
  today: Date,
): DailySummary {
  const since = now.getTime() - DAY;
  const openTasks = tasks.filter((t) => t.status === "OPEN");
  const openPunch = punch.filter((p) => p.status === "OPEN");
  const tomorrow = today.getTime() + DAY;
  return {
    newTasks: openTasks.filter((t) => t.createdAt.getTime() >= since).length,
    dueTomorrow: openTasks.filter((t) => t.dueDate.getTime() === tomorrow).length + openPunch.filter((p) => p.dueDate?.getTime() === tomorrow).length,
    overdue: openTasks.filter((t) => t.dueDate.getTime() < today.getTime()).length + openPunch.filter((p) => p.dueDate && p.dueDate.getTime() < today.getTime()).length,
    newPunch: openPunch.filter((p) => p.createdAt.getTime() >= since).length,
  };
}
