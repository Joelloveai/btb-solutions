"use client";

import { MessageCircle } from "lucide-react";
import { deleteTask, setTaskStatus } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { useSubmit } from "@/components/forms/use-submit";
import { ImageViewer } from "@/components/photos/image-viewer";
import type { Lookups } from "@/components/projects/lookups";
import { Badge } from "@/components/ui/badge";
import { Button, linkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AddTaskForm } from "./add-task-form";

export type TaskRow = {
  id: string;
  description: string;
  isMilestone: boolean;
  subcontractorName: string | null;
  dueText: string;
  status: "OPEN" | "DONE";
  overdue: boolean;
  completedText: string | null;
  photoId: string | null;
  reminderHref: string | null;
  hasSub: boolean;
};

function StatusButton({ id, status }: { id: string; status: "OPEN" | "DONE" }) {
  const { pending, submit } = useSubmit(status === "DONE" ? "Task reopened" : "Marked done", () => {});
  return (
    <Button small variant="secondary" disabled={pending} onClick={() => submit(() => setTaskStatus(id, status === "DONE" ? "OPEN" : "DONE"))}>
      {status === "DONE" ? "Reopen" : "Mark done"}
    </Button>
  );
}

export function TasksPanel({ projectId, rows, lookups }: { projectId: string; rows: TaskRow[]; lookups: Lookups }) {
  return (
    <>
      <div className="mb-3 flex justify-end">
        <AddTaskForm projectId={projectId} lookups={lookups} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          hint="Add tasks for your subcontractors. They show on the client's timeline."
          action={<AddTaskForm projectId={projectId} lookups={lookups} />}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{row.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.isMilestone ? "Milestone" : (row.subcontractorName ?? "Own crew")} · due {row.dueText}
                    {row.completedText ? ` · done ${row.completedText}` : ""}
                  </p>
                </div>
                <Badge tone={row.status === "DONE" ? "green" : row.overdue ? "red" : "yellow"}>
                  {row.status === "DONE" ? "Done" : row.overdue ? "Overdue" : "Open"}
                </Badge>
              </div>
              {row.photoId ? (
                <div className="mt-2 w-28">
                  <ImageViewer id={row.photoId} title={`Photo: ${row.description}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${row.photoId}`} alt={`Photo for ${row.description}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  </ImageViewer>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center justify-end gap-2 print:hidden">
                {row.status === "OPEN" && row.hasSub ? (
                  row.reminderHref ? (
                    <a href={row.reminderHref} target="_blank" rel="noreferrer" className={linkButton("secondary", true)}>
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      WhatsApp reminder
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Add a phone number to the subcontractor to send reminders</span>
                  )
                ) : null}
                <StatusButton id={row.id} status={row.status} />
                <DeleteIconButton label="Delete task" message={`Delete "${row.description}"?`} onConfirm={() => deleteTask(row.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
