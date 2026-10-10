"use client";

import dynamic from "next/dynamic";

// dhtmlx-gantt reads `window` when it loads, so it must never run on the server.
export const ProjectGantt = dynamic(() => import("./project-gantt").then((m) => m.ProjectGantt), {
  ssr: false,
  loading: () => <div className="h-[320px] animate-pulse rounded-xl border bg-muted" />,
});
