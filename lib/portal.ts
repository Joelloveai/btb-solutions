import { redirect } from "next/navigation";
import { requireClient, requireSub } from "./auth";

/** The signed-in client, or a redirect to the client login. Checked against the database every time. */
export async function clientOrRedirect() {
  try {
    return await requireClient();
  } catch {
    redirect("/client/login");
  }
}

/** The signed-in subcontractor, or a redirect to the sign-in page. */
export async function subOrRedirect() {
  try {
    return await requireSub();
  } catch {
    redirect("/login");
  }
}
