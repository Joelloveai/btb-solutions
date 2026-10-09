"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient, listClients } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

const NEW = "__new__";

type Option = { id: string; name: string };

/** Dropdown of stored clients, with an inline mini-form to create one without leaving the project form. */
export function ClientPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [clients, setClients] = useState<Option[]>([]);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: "", contactPerson: "", phone: "", email: "" });

  useEffect(() => {
    listClients().then((r) => {
      if (r.ok && r.data) setClients(r.data);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const result = await createClient(draft);
    setSaving(false);
    if (result.ok && result.data) {
      const created = result.data;
      setClients((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.id);
      setCreating(false);
      setDraft({ name: "", contactPerson: "", phone: "", email: "" });
      toast.success("Client created");
    } else if (!result.ok) {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-3">
      <Field label="Client (optional)">
        <Select
          value={creating ? NEW : value}
          onChange={(e) => {
            if (e.target.value === NEW) setCreating(true);
            else {
              setCreating(false);
              onChange(e.target.value);
            }
          }}
        >
          <option value="">— No client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW}>+ Create new client…</option>
        </Select>
      </Field>
      {creating ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted p-3">
          <Field label="New client name">
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Contact person (optional)">
            <Input value={draft.contactPerson} onChange={(e) => setDraft({ ...draft, contactPerson: e.target.value })} />
          </Field>
          <Field label="Phone (optional)">
            <Input type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
          <Field label="Email (optional)">
            <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save client"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
