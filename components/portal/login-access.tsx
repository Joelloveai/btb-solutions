"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createClientUser, createSubcontractorUser, deleteClientUser, deleteSubcontractorUser } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { loginUserSchema, type LoginUserInput } from "@/lib/validators";

export type AccessUser = { id: string; email: string; name: string | null };

function Form({ onCreate, close }: { onCreate: (input: LoginUserInput) => ReturnType<typeof createClientUser>; close: () => void }) {
  const { pending, submit } = useSubmit("Login created", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginUserInput>({ resolver: zodResolver(loginUserSchema), defaultValues: { email: "", password: "", name: "" } });
  return (
    <form onSubmit={handleSubmit((v) => submit(() => onCreate(v)))} className="space-y-3">
      <Field label="Name (optional)" error={errors.name?.message}>
        <Input {...register("name")} autoComplete="off" />
      </Field>
      <Field label="Login email" error={errors.email?.message}>
        <Input {...register("email")} type="email" autoComplete="off" />
      </Field>
      <Field label="Temporary password (min 8)" error={errors.password?.message}>
        <Input {...register("password")} type="text" autoComplete="off" />
      </Field>
      <p className="text-xs text-muted-foreground">Give them this email and password. They can only see what their page shows.</p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Create login"}
      </Button>
    </form>
  );
}

/** Staff-side card to give someone a login (client portal or subcontractor task log), or take it away. */
export function LoginAccess({
  title,
  description,
  loginPath,
  users,
  kind,
  ownerId,
}: {
  title: string;
  description: string;
  loginPath: string;
  users: AccessUser[];
  /** "client": a portal login for a client record. "sub": a task-log login for a subcontractor. */
  kind: "client" | "sub";
  ownerId: string;
}) {
  const onCreate = (input: LoginUserInput) => (kind === "client" ? createClientUser(ownerId, input) : createSubcontractorUser(ownerId, input));
  const onDelete = kind === "client" ? deleteClientUser : deleteSubcontractorUser;
  return (
    <Card className="mb-4 p-3 sm:mb-6 sm:p-4" role="region" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {description} Sign-in page: <span className="font-mono">{loginPath}</span>
          </p>
        </div>
        <ModalButton label="+ Add login" title={title} variant="secondary">
          {(close) => <Form onCreate={onCreate} close={close} />}
        </ModalButton>
      </div>
      {users.length > 0 ? (
        <ul className="mt-3 divide-y rounded-md border">
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate">
                {user.name ? `${user.name} · ` : ""}
                {user.email}
              </span>
              <DeleteIconButton
                label={`Revoke access for ${user.email}`}
                message={`Remove ${user.email}'s access? They will be signed out of the portal.`}
                onConfirm={() => onDelete(user.id)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
