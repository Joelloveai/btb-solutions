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

/** OPEN -> DONE (the subcontractor says it is fixed) -> CLOSED (the contractor has checked it). */
export const PUNCH_STATUSES = ["OPEN", "DONE", "CLOSED"] as const;
export type PunchStatus = (typeof PUNCH_STATUSES)[number];

export const PUNCH_STATUS_LABELS: Record<PunchStatus, string> = {
  OPEN: "Open",
  DONE: "Fixed, to verify",
  CLOSED: "Closed",
};

export const DOCUMENT_TYPES = ["Drawing", "Specification", "Contract", "Other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** The five stages the client sees on their timeline. */
export const PROJECT_STAGES = ["Demo", "Framing", "Rough-in", "Finishing", "Completed"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const SELECTION_CATEGORIES = ["Tiles", "Paint", "Fixtures", "Appliances", "Flooring", "Other"] as const;

/** What a TimelineEvent records. Events are never edited or removed; a change appends a new event. */
export const TIMELINE_EVENT_TYPES = [
  "PHOTO",
  "COST",
  "PAYMENT",
  "CLAIM",
  "CHANGE_ORDER",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "PUNCH_CREATED",
  "PUNCH_RESOLVED",
  "DOCUMENT_UPLOADED",
  "SITE_DIARY",
  "MESSAGE",
  "APPROVAL",
  "STAGE_CHANGED",
  "NOTE",
] as const;
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

/** The filter chips on the Timeline tab. */
export const TIMELINE_FILTERS = [
  { id: "all", label: "All", types: null },
  { id: "photos", label: "Photos", types: ["PHOTO"] },
  { id: "money", label: "Money", types: ["COST", "PAYMENT", "CLAIM", "CHANGE_ORDER"] },
  { id: "tasks", label: "Tasks", types: ["TASK_CREATED", "TASK_COMPLETED", "PUNCH_CREATED", "PUNCH_RESOLVED"] },
  { id: "documents", label: "Documents", types: ["DOCUMENT_UPLOADED"] },
  { id: "diary", label: "Diary", types: ["SITE_DIARY", "NOTE"] },
] as const;

export const DIARY_WEATHER = ["Sunny", "Cloudy", "Rain", "Heavy rain"] as const;
export const DIARY_MACHINERY = ["Excavator", "Crane", "Concrete mixer", "Scaffolding", "Generator", "Compressor", "Lorry"] as const;
export const DIARY_MANPOWER_TRADES = ["General worker", ...PHOTO_TRADES] as const;
