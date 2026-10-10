import { z } from "zod";
import {
  CHANGE_ORDER_STATUSES,
  COST_CATEGORIES,
  PROJECT_STATUSES,
  QUOTE_STATUSES,
} from "./constants";

const money = z
  .string()
  .trim()
  .regex(/^-?\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 1250.50");

const positiveMoney = money.refine((v) => Number(v) > 0, "Must be more than 0");
const nonZeroMoney = money.refine((v) => Number(v) !== 0, "Cannot be 0");

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const optionalText = z.string().trim().max(200).optional().or(z.literal(""));

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name").max(120),
  clientId: z.string().optional().or(z.literal("")),
  contractValue: positiveMoney,
  startDate: dateString.optional().or(z.literal("")),
  sstEnabled: z.boolean(),
  retentionPercent: z
    .string()
    .trim()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage like 5")
    .refine((v) => Number(v) <= 100, "Cannot be more than 100"),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export const costSchema = z.object({
  date: dateString,
  category: z.enum(COST_CATEGORIES),
  description: z.string().trim().min(1, "Enter a description").max(200),
  amount: positiveMoney,
  vendor: optionalText,
  reference: optionalText,
  subcontractorId: z.string().optional().or(z.literal("")),
  boqLineId: z.string().optional().or(z.literal("")),
});

export const paymentSchema = z.object({
  date: dateString,
  amount: positiveMoney,
  reference: optionalText,
  claimId: z.string().optional().or(z.literal("")),
});

export const changeOrderSchema = z.object({
  date: dateString,
  description: z.string().trim().min(1, "Enter a description").max(200),
  amount: nonZeroMoney,
  boqLineId: z.string().optional().or(z.literal("")),
});

export const changeOrderStatusSchema = z.enum(CHANGE_ORDER_STATUSES);

const quantity = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, "Enter a quantity like 12 or 2.5")
  .refine((v) => Number(v) > 0, "Quantity must be more than 0");

const unitPrice = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a price like 85.50");

export const lineSchema = z.object({
  description: z.string().trim().min(1, "Enter a description").max(200),
  qty: quantity,
  unit: z.string().trim().min(1, "Enter a unit").max(20),
  unitPrice,
});

export const quoteSchema = z.object({
  clientName: z.string().trim().min(1, "Enter the client name").max(120),
  title: z.string().trim().min(1, "Enter a project title").max(120),
  date: dateString,
  sstEnabled: z.boolean(),
  status: z.enum(QUOTE_STATUSES),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  lines: z.array(lineSchema).min(1, "Add at least one line"),
});

export const quoteStatusSchema = z.enum(QUOTE_STATUSES);

export const boqLineSchema = z.object({
  description: z.string().trim().min(1, "Enter a description").max(200),
  qty: quantity,
  unit: z.string().trim().min(1, "Enter a unit").max(20),
  rate: unitPrice,
});

export const claimSchema = z.object({
  date: dateString,
  workDone: positiveMoney,
});

export const releaseRetentionSchema = z.object({
  date: dateString,
  amount: positiveMoney,
});

export const subcontractorSchema = z.object({
  name: z.string().trim().min(1, "Enter the subcontractor name").max(120),
  contact: optionalText,
  trade: optionalText,
  bank: optionalText,
});

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Enter the client name").max(120),
  contactPerson: optionalText,
  phone: optionalText,
  email: z.string().trim().max(200).email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const paidDateSchema = dateString;

export type ProjectInput = z.infer<typeof projectSchema>;
export type CostInput = z.infer<typeof costSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ChangeOrderInput = z.infer<typeof changeOrderSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type BoqLineInput = z.infer<typeof boqLineSchema>;
export type ClaimInput = z.infer<typeof claimSchema>;
export type SubcontractorInput = z.infer<typeof subcontractorSchema>;
export type ClientInput = z.infer<typeof clientSchema>;

export const taskSchema = z.object({
  description: z.string().trim().min(1, "Enter what needs doing").max(200),
  subcontractorId: z.string().optional().or(z.literal("")),
  startDate: dateString.optional().or(z.literal("")),
  dueDate: dateString,
  isMilestone: z.boolean(),
});

export const loginUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(8, "Use at least 8 characters").max(100),
  name: z.string().trim().max(120).optional().or(z.literal("")),
});

export type TaskInput = z.infer<typeof taskSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
