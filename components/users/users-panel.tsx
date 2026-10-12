"use client";

import { useState } from "react";
import { inviteUser, resetUserPassword, setUserActive } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ROLE_HELP, ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/permissions";

export type UserRow = { id: string; name: string; email: string; role: StaffRole; active: boolean; lastLoginText: string; mustChange: boolean; isMe: boolean };

function InviteDialog({ onClose }: { onClose: () => void }) {
  const { pending, submit } = useSubmit("Person added. Give them the temporary password.", onClose);
  const [form, setForm] = useState({ name: "", email: "", role: "SUPERVISOR", tempPassword: "" });
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        submit(async () => {
          const result = await inviteUser(form);
          if (!result.ok) setError(result.error);
          return result;
        });
      }}
    >
      <Field label="Name">
        <Input value={form.name} onChange={set("name")} autoComplete="off" required />
      </Field>
      <Field label="Email">
        <Input type="email" value={form.email} onChange={set("email")} autoComplete="off" required />
      </Field>
      <Field label="Role">
        <Select value={form.role} onChange={set("role")}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-sm text-muted-foreground">{ROLE_HELP[form.role as StaffRole]}</p>
      <Field label="Temporary password (8 or more characters)">
        <Input type="text" value={form.tempPassword} onChange={set("tempPassword")} autoComplete="off" required />
      </Field>
      <p className="text-xs text-muted-foreground">They will be asked to choose their own password the first time they sign in.</p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Adding…" : "Add person"}
      </Button>
    </form>
  );
}

function ResetDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { pending, submit } = useSubmit("New temporary password set. Give it to them.", onClose);
  const [pw, setPw] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => resetUserPassword(user.id, pw));
      }}
    >
      <p className="text-sm text-muted-foreground">{user.name} will have to choose a new password the next time they sign in.</p>
      <Field label="New temporary password (8 or more characters)">
        <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending || pw.length < 8}>
        {pending ? "Saving…" : "Set temporary password"}
      </Button>
    </form>
  );
}

function RowActions({ user }: { user: UserRow }) {
  const [resetting, setResetting] = useState(false);
  const { pending, submit } = useSubmit(user.active ? "Deactivated. They are signed out." : "Reactivated.", () => {});
  if (user.isMe) return <span className="text-sm text-muted-foreground">This is you</span>;
  return (
    <div className="flex flex-wrap gap-2">
      <Button small variant="secondary" onClick={() => setResetting(true)}>
        Reset Password
      </Button>
      <Button small variant={user.active ? "danger" : "secondary"} disabled={pending} onClick={() => submit(() => setUserActive(user.id, !user.active))}>
        {user.active ? "Deactivate" : "Reactivate"}
      </Button>
      <Modal open={resetting} onClose={() => setResetting(false)} title={`Reset password for ${user.name}`}>
        {resetting ? <ResetDialog user={user} onClose={() => setResetting(false)} /> : null}
      </Modal>
    </div>
  );
}

export function UsersPanel({ rows }: { rows: UserRow[] }) {
  const [inviting, setInviting] = useState(false);
  return (
    <section aria-label="Users" className="space-y-4">
      <Button onClick={() => setInviting(true)}>Invite User</Button>
      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite user">
        {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
      </Modal>

      <div className="hidden md:block">
        <table className="w-full text-left text-sm" data-testid="users-table">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-semibold">Name</th>
              <th className="py-2 pr-3 font-semibold">Email</th>
              <th className="py-2 pr-3 font-semibold">Role</th>
              <th className="py-2 pr-3 font-semibold">Status</th>
              <th className="py-2 pr-3 font-semibold">Last login</th>
              <th className="py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b align-middle" data-testid="user-row">
                <td className="py-2 pr-3 font-medium">{u.name}</td>
                <td className="py-2 pr-3">{u.email}</td>
                <td className="py-2 pr-3">{ROLE_LABELS[u.role]}</td>
                <td className="py-2 pr-3">
                  <Badge tone={u.active ? "green" : "gray"}>{u.active ? "Active" : "Deactivated"}</Badge>
                  {u.mustChange ? <span className="ml-2 text-xs text-muted-foreground">has not set own password</span> : null}
                </td>
                <td className="py-2 pr-3">{u.lastLoginText}</td>
                <td className="py-2">
                  <RowActions user={u} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((u) => (
          <li key={u.id} className="space-y-2 rounded-xl border bg-card p-3 shadow-sm" data-testid="user-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{u.name}</p>
              <Badge tone={u.active ? "green" : "gray"}>{u.active ? "Active" : "Deactivated"}</Badge>
            </div>
            <p className="break-all text-sm text-muted-foreground">{u.email}</p>
            <p className="text-sm">
              {ROLE_LABELS[u.role]} · last login {u.lastLoginText}
            </p>
            <RowActions user={u} />
          </li>
        ))}
      </ul>
    </section>
  );
}
