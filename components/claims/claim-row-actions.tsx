"use client";

import { deleteClaim } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";

export function DeleteClaimButton({ id, number }: { id: string; number: number }) {
  return (
    <DeleteIconButton
      label="Delete claim"
      message={`Delete claim ${number}? This cannot be undone.`}
      onConfirm={() => deleteClaim(id)}
    />
  );
}
