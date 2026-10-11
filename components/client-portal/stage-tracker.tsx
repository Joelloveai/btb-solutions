import { Check, Circle } from "lucide-react";
import { PROJECT_STAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Where the job is up to: finished stages ticked, the current one highlighted in amber. */
export function StageTracker({ stage }: { stage: string | null }) {
  const current = stage ? (PROJECT_STAGES as readonly string[]).indexOf(stage) : -1;
  const finished = stage === "Completed";
  return (
    <div>
      <ol aria-label="Project stages" className="grid grid-cols-5 gap-1 sm:gap-2" data-testid="stage-tracker">
        {PROJECT_STAGES.map((name, index) => {
          const state = finished || index < current ? "done" : index === current ? "current" : "todo";
          return (
            <li key={name} data-state={state} className="flex flex-col items-center gap-1 text-center">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2",
                  state === "done" && "border-profit bg-profit text-white",
                  state === "current" && "border-accent bg-accent text-white",
                  state === "todo" && "border-border bg-card text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="h-4 w-4" aria-label="Done" /> : <Circle className="h-3 w-3" aria-hidden="true" />}
              </span>
              <span className={cn("text-[11px] leading-tight sm:text-xs", state === "current" ? "font-semibold text-accent" : state === "done" ? "text-foreground" : "text-muted-foreground")}>{name}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm" data-testid="current-stage">
        {finished ? (
          <span className="font-semibold text-profit">Your project is complete.</span>
        ) : stage ? (
          <>
            <span className="rounded-full border border-accent/40 bg-accent-light px-2.5 py-0.5 text-xs font-semibold text-accent">Current stage</span> <span className="font-semibold">{stage}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Work has not started yet.</span>
        )}
      </p>
    </div>
  );
}
