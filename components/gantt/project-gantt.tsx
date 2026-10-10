"use client";

import "dhtmlx-gantt/codebase/dhtmlxgantt.css";
import { gantt } from "dhtmlx-gantt";
import { useEffect, useRef } from "react";
import type { GanttTask } from "@/lib/gantt";

/**
 * Read-only project timeline (dhtmlx-gantt, MIT). The contractor defines the tasks in the main app;
 * here they can only be looked at: no dragging, no editing, no links.
 */
export function ProjectGantt({ tasks }: { tasks: GanttTask[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    gantt.config.readonly = true;
    gantt.config.date_format = "%Y-%m-%d";
    gantt.config.show_links = false;
    gantt.config.show_progress = true;
    gantt.config.row_height = 34;
    gantt.config.scale_height = 52;
    gantt.config.fit_tasks = true;
    // Pick a scale from the schedule's real length (first start to last finish), so the whole
    // project, milestones included, fits on screen instead of running off to the right.
    const starts = tasks.map((t) => new Date(t.start_date).getTime());
    const ends = tasks.map((t, i) => (starts[i] ?? 0) + Math.max(t.duration, 1) * 86400000);
    const span = starts.length ? (Math.max(...ends) - Math.min(...starts)) / 86400000 : 0;
    gantt.config.smart_rendering = false; // a client's schedule is small: draw every bar
    if (span <= 21) {
      gantt.config.scales = [
        { unit: "month", step: 1, format: "%M %Y" },
        { unit: "day", step: 1, format: "%j" },
      ];
      gantt.config.min_column_width = 30;
    } else if (span <= 200) {
      gantt.config.scales = [
        { unit: "month", step: 1, format: "%M %Y" },
        { unit: "week", step: 1, format: "Wk %W" },
      ];
      gantt.config.min_column_width = 44;
    } else {
      gantt.config.scales = [
        { unit: "year", step: 1, format: "%Y" },
        { unit: "month", step: 1, format: "%M" },
      ];
      gantt.config.min_column_width = 40;
    }
    // A narrower name column on phones leaves room for the bars.
    gantt.config.columns = [{ name: "text", label: "Task", tree: false, width: container.current.clientWidth < 520 ? 110 : 180, resize: false }];
    gantt.templates.task_class = (_start, _end, task) => (task.progress === 1 ? "gantt-done" : "gantt-open");
    gantt.init(container.current);
    gantt.parse({ data: tasks.map((t) => ({ ...t })) });
    return () => {
      gantt.clearAll();
    };
  }, [tasks]);

  return (
    <>
      <style>{`
        .gantt_task_line.gantt-open { background: #94a3b8; border-color: #64748b; }
        .gantt_task_line.gantt-done { background: #15803d; border-color: #166534; }
        .gantt_task_line .gantt_task_content { color: #fff; font-size: 11px; }
        .gantt_milestone { background: #b45309; }
        @media print { .gantt_container { height: auto !important; } }
      `}</style>
      <div ref={container} className="h-[320px] w-full rounded-xl border bg-card print:h-auto" data-testid="gantt" />
    </>
  );
}
