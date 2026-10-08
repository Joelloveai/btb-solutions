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
