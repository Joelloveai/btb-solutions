import { z } from "zod";
import {
  CHANGE_ORDER_STATUSES,
  COST_CATEGORIES,
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
  clientName: optionalText,
  contractValue: positiveMoney,
  startDate: dateString.optional().or(z.literal("")),
});

export const costSchema = z.object({
  date: dateString,
  category: z.enum(COST_CATEGORIES),
  description: z.string().trim().min(1, "Enter a description").max(200),
  amount: positiveMoney,
  vendor: optionalText,
  reference: optionalText,
});

export const paymentSchema = z.object({
  date: dateString,
  amount: positiveMoney,
  reference: optionalText,
});

export const changeOrderSchema = z.object({
  date: dateString,
  description: z.string().trim().min(1, "Enter a description").max(200),
  amount: nonZeroMoney,
});

export const changeOrderStatusSchema = z.enum(CHANGE_ORDER_STATUSES);

export type ProjectInput = z.infer<typeof projectSchema>;
export type CostInput = z.infer<typeof costSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type ChangeOrderInput = z.infer<typeof changeOrderSchema>;
