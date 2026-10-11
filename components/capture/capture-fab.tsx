"use client";

import { Camera, HardHat, Plus, Receipt, StickyNote, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getCaptureContext } from "@/app/actions";
import { CostFormBody } from "@/components/forms/add-cost-form";
import { DiaryForm, type MaterialCost } from "@/components/diary/diary-form";
import { PhotoUpload } from "@/components/photos/photo-upload";
import type { Lookups } from "@/components/projects/lookups";
import { Modal } from "@/components/ui/modal";
import { NoteForm } from "@/components/timeline/note-form";
import { cn } from "@/lib/utils";

export type CaptureProject = { id: string; name: string };
export type CaptureTask = { id: string; description: string; projectId: string; projectName: string };

type Mode = "menu" | "photo" | "note" | "cost" | "diary";
type Choice = { mode: Exclude<Mode, "menu">; label: string; Icon: LucideIcon };

const ALL: Choice[] = [
  { mode: "photo", label: "Photo", Icon: Camera },
  { mode: "note", label: "Note", Icon: StickyNote },
  { mode: "cost", label: "Cost", Icon: Receipt },
  { mode: "diary", label: "Diary", Icon: HardHat },
];
// Costs and the site diary belong to the office and site supervisor; a subcontractor can add photos and notes.
const SUB_CHOICES = ALL.filter((c) => c.mode === "photo" || c.mode === "note");

const TITLES: Record<Mode, string> = { menu: "Add to timeline", photo: "Add photo", note: "Add note", cost: "Add cost", diary: "Site diary" };
const LAST_PROJECT = "btb-last-project";

const remembered = () => {
  try {
    return localStorage.getItem(LAST_PROJECT) ?? "";
  } catch {
    return "";
  }
};

const bigButton = "flex h-14 w-full items-center gap-3 rounded-xl border bg-card px-4 text-left text-base font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * The + button on every staff and subcontractor screen. One tap opens a sheet with the four things worth
 * capturing. Inside a project it already knows which project; elsewhere it asks once (and remembers).
 */
export function CaptureFab({ role, projects, tasks = [] }: { role: "staff" | "sub"; projects: CaptureProject[]; tasks?: CaptureTask[] }) {
  const pathname = usePathname();
  const inProject = role === "staff" ? /^\/projects\/([^/]+)/.exec(pathname)?.[1] ?? null : null;
  const [mode, setMode] = useState<Mode | null>(null);
  const [pickedProject, setPickedProject] = useState<string | null>(null);
  const [pickedTask, setPickedTask] = useState<string | null>(null);
  const [context, setContext] = useState<{ lookups: Lookups; materialCosts: MaterialCost[] } | null>(null);
  const close = useCallback(() => setMode(null), []);

  const known = (id: string | null) => (id && projects.some((p) => p.id === id) ? id : null);
  // On a project's own page the project is known even if it is not in the (active-only) pick list.
  const projectId = inProject ?? known(pickedProject);
  const needsProject = (mode === "photo" && role === "staff") || mode === "note" || mode === "cost" || mode === "diary";

  // Cost and diary need this project's lists; fetched when they are chosen.
  useEffect(() => {
    if (role !== "staff" || !projectId || (mode !== "cost" && mode !== "diary")) return;
    let live = true;
    setContext(null);
    const cacheKey = `btb-capture-${projectId}`;
    const empty = { lookups: { boqLines: [], subcons: [], claims: [] }, materialCosts: [] };
    // With no signal the form still opens: the last lists we had, or none (the 3 main fields never need them).
    const fallback = () => {
      try {
        return JSON.parse(localStorage.getItem(cacheKey) ?? "null") ?? empty;
      } catch {
        return empty;
      }
    };
    getCaptureContext(projectId).then(
      (r) => {
        if (!live) return;
        if (r.ok) {
          setContext(r.data!);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(r.data));
          } catch {
            /* not cached */
          }
        } else setContext(fallback());
      },
      () => live && setContext(fallback()),
    );
    return () => {
      live = false;
    };
  }, [mode, projectId, role]);

  const choose = (m: Exclude<Mode, "menu">) => {
    setMode(m);
    if (!inProject && role === "staff") setPickedProject(null); // ask again unless the screen already says which
  };
  const pickProject = (id: string) => {
    setPickedProject(id);
    try {
      localStorage.setItem(LAST_PROJECT, id);
    } catch {
      /* not remembered */
    }
  };
  const lastFirst = [...projects].sort((a, b) => Number(b.id === remembered()) - Number(a.id === remembered()));
  const choices = role === "staff" ? ALL : SUB_CHOICES;
  const chosenTask = tasks.find((t) => t.id === pickedTask) ?? null;

  let body: React.ReactNode = null;
  if (mode === "menu") {
    body = (
      <div className="grid gap-2">
        {choices.map(({ mode: m, label, Icon }) => (
          <button key={m} type="button" onClick={() => choose(m)} className={bigButton}>
            <Icon className="h-6 w-6" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    );
  } else if (role === "sub" && mode === "photo") {
    body = chosenTask ? (
      <PhotoUpload kind="TASK" taskId={chosenTask.id} projectId={chosenTask.projectId} label="Take photo" withCaption={false} autoOpen onDone={close} />
    ) : tasks.length === 0 ? (
      <p className="text-sm text-muted-foreground">You have no open tasks to add a photo to.</p>
    ) : (
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">Which job is the photo of?</p>
        {tasks.map((t) => (
          <button key={t.id} type="button" onClick={() => setPickedTask(t.id)} className={bigButton}>
            <span className="min-w-0">
              <span className="block truncate">{t.description}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{t.projectName}</span>
            </span>
          </button>
        ))}
      </div>
    );
  } else if (needsProject && !projectId) {
    body =
      projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">Which project?</p>
          {lastFirst.map((p) => (
            <button key={p.id} type="button" onClick={() => pickProject(p.id)} className={bigButton}>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      );
  } else if (mode === "photo" && projectId) {
    body = <PhotoUpload kind="PROGRESS" projectId={projectId} label="Take photo" autoOpen onDone={close} />;
  } else if (mode === "note" && projectId) {
    body = <NoteForm projectId={projectId} close={close} as={role} />;
  } else if (mode === "cost" && projectId) {
    body = context ? <CostFormBody projectId={projectId} lookups={context.lookups} close={close} /> : <p className="text-sm text-muted-foreground">Getting ready…</p>;
  } else if (mode === "diary" && projectId) {
    body = context ? <DiaryForm projectId={projectId} materialCosts={context.materialCosts} close={close} /> : <p className="text-sm text-muted-foreground">Getting ready…</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPickedTask(null);
          setMode("menu");
        }}
        aria-label="Add to timeline"
        className={cn(
          "fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden md:bottom-6",
        )}
      >
        <Camera className="h-6 w-6" aria-hidden="true" />
        <Plus className="absolute right-1.5 top-1.5 h-4 w-4 rounded-full bg-white text-accent" aria-hidden="true" />
      </button>
      <Modal open={mode !== null} onClose={close} title={mode ? TITLES[mode] : TITLES.menu}>
        {body}
      </Modal>
    </>
  );
}
