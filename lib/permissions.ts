/**
 * Who may do what in the office app. One small table, used by the server (the real guard) and the
 * screens (to hide what a person cannot use).
 *
 *   ADMIN       everything, including managing users
 *   MANAGER     all projects, costs, claims and quotes; cannot manage users
 *   SUPERVISOR  site work only: add costs, photos, diaries, tasks, punch items, notes. Sees no claims, receivables or profit
 *   VIEWER      looks, never changes
 */
export const STAFF_ROLES = ["ADMIN", "MANAGER", "SUPERVISOR", "VIEWER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = { ADMIN: "Admin", MANAGER: "Manager", SUPERVISOR: "Supervisor", VIEWER: "Viewer" };
export const ROLE_HELP: Record<StaffRole, string> = {
  ADMIN: "Everything, including adding and removing people",
  MANAGER: "All projects, costs, claims and quotes",
  SUPERVISOR: "Site work: costs, photos, diaries, tasks. No claims, receivables or profit",
  VIEWER: "Can look, cannot change anything",
};

export type Capability =
  /** Any signed-in office person (own profile, language). */
  | "staff.any"
  /** Add, edit and remove users. */
  | "users.manage"
  /** See claims, receivables, payments, quotes, profit and what subcontractors are owed. */
  | "financials.view"
  /** Change money records and the contract: payments, claims, change orders, quotes, documents, client portal. */
  | "money.write"
  /** Site work: add costs, photos, diaries, tasks, punch items and notes. */
  | "field.write";

const TABLE: Record<Capability, readonly StaffRole[]> = {
  "staff.any": ["ADMIN", "MANAGER", "SUPERVISOR", "VIEWER"],
  "users.manage": ["ADMIN"],
  "financials.view": ["ADMIN", "MANAGER", "VIEWER"],
  "money.write": ["ADMIN", "MANAGER"],
  "field.write": ["ADMIN", "MANAGER", "SUPERVISOR"],
};

export const isStaffRole = (value: unknown): value is StaffRole => typeof value === "string" && (STAFF_ROLES as readonly string[]).includes(value);

/** An unknown or missing role can do nothing. */
export const can = (role: unknown, capability: Capability): boolean => isStaffRole(role) && TABLE[capability].includes(role);

/** The timeline events a person without financial access must not see. */
export const FINANCIAL_EVENT_TYPES = ["PAYMENT", "CLAIM", "CHANGE_ORDER"] as const;
