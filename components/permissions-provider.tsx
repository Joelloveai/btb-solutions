"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type Capability, type StaffRole } from "@/lib/permissions";

const Context = createContext<StaffRole | null>(null);

/** Tells the screens what the signed-in office person may do, so they can hide what is not theirs. The server still decides. */
export function PermissionsProvider({ role, children }: { role: StaffRole | null; children: ReactNode }) {
  return <Context.Provider value={role}>{children}</Context.Provider>;
}

export function useCan() {
  const role = useContext(Context);
  return (capability: Capability) => can(role, capability);
}
