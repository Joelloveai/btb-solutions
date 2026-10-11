import type { Session } from "next-auth";
import { roleOf } from "@/lib/auth";
import type { Actor } from "@/lib/timeline";

export function actorFromSession(session: Session | null): Actor {
  const role = roleOf(session) ?? "staff";
  return { id: session?.user?.id ?? null, role, name: session?.user?.name ?? session?.user?.email ?? null };
}
