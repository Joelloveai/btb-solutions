"use client";

import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSiteWeather } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { VoiceInput } from "@/components/ui/voice-input";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { DIARY_MACHINERY, DIARY_MANPOWER_TRADES, DIARY_WEATHER } from "@/lib/constants";
import { todayInputValue } from "@/lib/format";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

export type MaterialCost = { dateKey: string; description: string };

/**
 * Today's site diary. Only four things are asked up front (weather, who is on site, what was done,
 * problems); the rest is under "More". The deliveries of the day are filled in from the costs already entered.
 */
export function DiaryForm({ projectId, materialCosts, close }: { projectId: string; materialCosts: MaterialCost[]; close: () => void }) {
  const [date, setDate] = useState(todayInputValue());
  const [weather, setWeather] = useState<string>("");
  const [manpower, setManpower] = useState<Record<string, number>>({});
  const [machinery, setMachinery] = useState<string[]>([]);
  const [worksDone, setWorksDone] = useState("");
  const [issues, setIssues] = useState("");
  const [visitorLog, setVisitorLog] = useState("");
  const [safety, setSafety] = useState("");
  const [weatherNote, setWeatherNote] = useState("");
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);
  const autoWeather = useRef("");

  // Fill in the weather from the site's GPS when we can (needs signal and a weather key); otherwise the person taps it.
  useEffect(() => {
    let live = true;
    getSiteWeather(projectId).then(
      (r) => {
        if (!live || !r.ok || !r.data) return;
        autoWeather.current = r.data.weather;
        setWeather((cur) => cur || r.data!.weather);
        setWeatherNote(r.data.note);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [projectId]);
  const { pending, submit } = useOfflineSubmit("Saved. Your diary is signed and waiting for a countersignature.", close);
  const delivered = materialCosts.filter((c) => c.dateKey === date);
  const total = Object.values(manpower).reduce((t, n) => t + n, 0);

  const step = (trade: string, by: number) => setManpower((m) => ({ ...m, [trade]: Math.max(0, Math.min(999, (m[trade] ?? 0) + by)) }));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const signature = pad.current?.toDataUrl();
        if (!weather) return setError("Tap today's weather.");
        if (!worksDone.trim()) return setError("Say what was done today.");
        if (!signature) return setError("Please sign in the box.");
        setError("");
        submit({
          type: "createDiary",
          projectId,
          label: `Site diary ${date}`,
          payload: { input: { date, weather, manpower, machinery, worksDone, issues, visitorLog, safetyObservations: safety, weatherNote: weatherNote && weather === autoWeather.current ? weatherNote : "", signature } },
        });
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Weather</legend>
        {weatherNote && weather === autoWeather.current ? (
          <p className="mb-2 text-sm text-muted-foreground" data-testid="weather-auto">
            Filled in automatically: {weatherNote}. Tap another to change it.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {DIARY_WEATHER.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={weather === w}
              onClick={() => setWeather(w)}
              className={clsx("min-h-12 rounded-lg border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", weather === w ? "border-primary bg-primary text-primary-foreground" : "bg-card")}
            >
              {w}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">
          Workers on site <span className="text-muted-foreground">(total {total})</span>
        </legend>
        <ul className="space-y-2">
          {DIARY_MANPOWER_TRADES.map((trade) => (
            <li key={trade} className="flex items-center justify-between gap-2">
              <span className="text-sm">{trade}</span>
              <span className="flex items-center gap-2">
                <button type="button" aria-label={`Fewer ${trade}`} onClick={() => step(trade, -1)} className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <output aria-label={`${trade} count`} className="w-8 text-center text-base font-semibold">
                  {manpower[trade] ?? 0}
                </output>
                <button type="button" aria-label={`More ${trade}`} onClick={() => step(trade, 1)} className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </fieldset>

      <Field label="Works done today">
        <VoiceInput multiline value={worksDone} onChange={(e) => setWorksDone(e.target.value)} maxLength={4000} placeholder="e.g. Tiled the master bath floor" />
      </Field>
      <Field label="Problems or instructions">
        <VoiceInput multiline value={issues} onChange={(e) => setIssues(e.target.value)} maxLength={4000} placeholder="Anything that slowed us down, or was instructed" />
      </Field>

      <details className="group rounded-md border border-input">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
          <span>More</span>
          <span className="text-muted-foreground group-open:hidden">date, machinery, safety, visitors</span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <Field label="Date">
            <Input type="date" value={date} max={todayInputValue()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Machinery on site</legend>
            {DIARY_MACHINERY.map((m) => (
              <label key={m} className="flex min-h-12 items-center gap-3 text-base">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={machinery.includes(m)}
                  onChange={(e) => setMachinery((cur) => (e.target.checked ? [...cur, m] : cur.filter((x) => x !== m)))}
                />
                {m}
              </label>
            ))}
          </fieldset>
          <div>
            <p className="mb-1 text-sm font-medium">Materials delivered</p>
            <p className="text-sm text-muted-foreground" data-testid="diary-deliveries">
              {delivered.length ? delivered.map((d) => d.description).join(", ") : "From the material costs you enter for this day. None yet."}
            </p>
          </div>
          <Field label="Safety observations">
            <VoiceInput multiline value={safety} onChange={(e) => setSafety(e.target.value)} maxLength={2000} placeholder="Toolbox talk, PPE, near misses, hazards" />
          </Field>
          <Field label="Visitors">
            <VoiceInput multiline value={visitorLog} onChange={(e) => setVisitorLog(e.target.value)} maxLength={2000} placeholder="Who visited site, and why" />
          </Field>
        </div>
      </details>

      <SignaturePad ref={pad} label="Sign here to submit" onChange={setSigned} />
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Sign and submit diary"}
      </Button>
    </form>
  );
}
