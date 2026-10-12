import type { DefaultSession } from "next-auth";

import type { StaffRole } from "../lib/permissions";
import type { Role } from "../lib/roles";

declare module "next-auth" {
  interface User {
    role?: Role;
    clientId?: string;
    subcontractorId?: string;
    staffRole?: StaffRole;
    mustChangePassword?: boolean;
  }
  interface Session {
    user: DefaultSession["user"] & { id?: string; role?: Role; staffRole?: StaffRole; mustChangePassword?: boolean };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: Role;
    staffRole?: StaffRole;
    mustChange?: boolean;
  }
}
