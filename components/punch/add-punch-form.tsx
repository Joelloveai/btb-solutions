"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { Lookups } from "@/components/projects/lookups";
import { shrink } from "@/components/photos/shrink";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { VoiceInput } from "@/components/ui/voice-input";
import { ModalButton } from "@/components/ui/modal";
import { PHOTO_TRADES } from "@/lib/constants";
import { toStoredFile } from "@/lib/offline/files";
import { captureLocation, type Geo } from "@/lib/offline/geo";
import { punchSchema, type PunchInput } from "@/lib/validators";

function Form({ projectId, lookups, close }: { projectId: string; lookups: Lookups; close: () => void }) {
  const { pending, submit } = useOfflineSubmit("Punch item added", close);
  const photoInput = useRef<HTMLInputElement>(null);
  const geoRequest = useRef<Promise<Geo | null> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PunchInput>({
    resolver: zodResolver(punchSchema),
    defaultValues: { location: "", description: "", trade: "Other", subcontractorId: "", dueDate: "" },
  });

  const save = handleSubmit(async (values) => {
    setPreparing(true);
    try {
      const position = file ? await geoRequest.current : null;
      const stored = file ? await toStoredFile(await shrink(file), file.name) : undefined;
      submit({
        type: "createPunch",
        label: `Punch: ${values.location} · ${values.description}`,
        projectId,
        payload: { input: values },
        file: stored,
        fields: stored
          ? {
              kind: "PUNCH",
              projectId,
              trade: values.trade,
              phase: "Punch List",
              location: values.location,
              capturedAt: new Date(file?.lastModified || Date.now()).toISOString(),
              ...(position ? { latitude: String(position.latitude), longitude: String(position.longitude), accuracy: String(Math.round(position.accuracy)) } : {}),
            }
          : undefined,
      });
    } finally {
      setPreparing(false);
    }
  });

  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Location" error={errors.location?.message}>
        <Input {...register("location")} placeholder="e.g. Level 3, Unit 12, Master Bath" />
      </Field>
      <Field label="What needs fixing" error={errors.description?.message}>
        <VoiceInput {...register("description")} placeholder="e.g. Cracked tile by the shower" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Trade" error={errors.trade?.message}>
          <Select {...register("trade")}>
            {PHOTO_TRADES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due (optional)" error={errors.dueDate?.message}>
          <Input {...register("dueDate")} type="date" />
        </Field>
      </div>
      <Field label="Assign to" error={errors.subcontractorId?.message}>
        <Select {...register("subcontractorId")}>
          <option value="">— Not assigned yet —</option>
          {lookups.subcons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="space-y-2">
        <input ref={photoInput} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Photo of the defect" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            geoRequest.current = captureLocation(); // where the defect is
            photoInput.current?.click();
          }}
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          {file ? "Change photo" : "Photograph the defect"}
        </Button>
        {file ? <p className="truncate text-sm text-muted-foreground">{file.name}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={pending || preparing}>
        {pending || preparing ? "Saving…" : "Save punch item"}
      </Button>
    </form>
  );
}

export function AddPunchForm({ projectId, lookups }: { projectId: string; lookups: Lookups }) {
  return (
    <ModalButton label="+ Add Punch Item" title="Add punch item">
      {(close) => <Form projectId={projectId} lookups={lookups} close={close} />}
    </ModalButton>
  );
}
