export const COST_CATEGORIES = [
  "MATERIAL",
  "LABOR",
  "SUBCON",
  "EQUIPMENT",
  "OVERHEAD",
  "OTHER",
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  MATERIAL: "Material",
  LABOR: "Labor",
  SUBCON: "Subcon",
  EQUIPMENT: "Equipment",
  OVERHEAD: "Overhead",
  OTHER: "Other",
};

export const PROJECT_STATUSES = ["ACTIVE", "COMPLETED", "ON_HOLD", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};

export const CHANGE_ORDER_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

export const CHANGE_ORDER_LABELS: Record<ChangeOrderStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
};

export const TASK_STATUSES = ["OPEN", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  OPEN: "Open",
  DONE: "Done",
};

/** Trade and phase tags for site photos, punch items and drawings. Stored as these exact strings. */
export const PHOTO_TRADES = ["Structural", "M&E", "Plumbing", "Electrical", "Tiling", "Painting", "Carpentry", "Other"] as const;
export type PhotoTrade = (typeof PHOTO_TRADES)[number];

export const PHOTO_PHASES = ["Demo", "Framing", "Rough-in", "Pre-cover", "Finishing", "Punch List", "Final"] as const;
export type PhotoPhase = (typeof PHOTO_PHASES)[number];

/**
 * Things that must be photographed BEFORE they are covered up (poured over, boarded, plastered).
 * These are the photos that settle disputes, because after cover-up nobody can look again.
 */
export const BEFORE_COVER_ITEMS = [
  { key: "REBAR", label: "Rebar before pour", trade: "Structural" },
  { key: "SLEEVES", label: "Sleeves and penetrations", trade: "M&E" },
  { key: "FIRESTOPPING", label: "Firestopping", trade: "M&E" },
  { key: "INWALL_PLUMBING", label: "In-wall plumbing", trade: "Plumbing" },
] as const satisfies readonly { key: string; label: string; trade: PhotoTrade }[];
export type BeforeCoverKey = (typeof BEFORE_COVER_ITEMS)[number]["key"];
