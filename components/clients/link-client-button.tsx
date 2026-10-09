"use client";

import { linkProjectToClient } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Button } from "@/components/ui/button";

/** Shown once on an old project that only has a typed client name. */
export function LinkClientButton({ projectId }: { projectId: string }) {
  const { pending, submit } = useSubmit("Linked to client", () => {});
  return (
    <Button small variant="secondary" disabled={pending} onClick={() => submit(() => linkProjectToClient(projectId))}>
      Link to client
    </Button>
  );
}
