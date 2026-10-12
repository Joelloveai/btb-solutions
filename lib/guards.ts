import { redirect } from "next/navigation";
import { staffCan } from "@/lib/auth";

/** Top of every page about money. Middleware keeps people away too, but pages never trust that alone. */
export async function requireFinancialsPage() {
  if (!(await staffCan("financials.view"))) redirect("/projects");
}

/** Top of the user-management pages. */
export async function requireAdminPage() {
  if (!(await staffCan("users.manage"))) redirect("/projects");
}
