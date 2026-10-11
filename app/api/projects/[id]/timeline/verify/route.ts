import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { verifyProjectChain } from "@/lib/timeline";

export const dynamic = "force-dynamic";

/** Re-computes the project's hash chain and reports whether it is intact. Staff only. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return Response.json({ error: "Not signed in" }, { status: 401 });
  return Response.json(await verifyProjectChain(params.id), { headers: { "Cache-Control": "no-store" } });
}
