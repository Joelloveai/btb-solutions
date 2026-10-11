import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { fetchTimelinePage } from "@/lib/timeline-query";

export const dynamic = "force-dynamic";

/** One page of a project's timeline, newest first. Staff only: it carries money and who did what. */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return Response.json({ error: "Not signed in" }, { status: 401 });
  const url = new URL(request.url);
  const page = await fetchTimelinePage(params.id, url.searchParams.get("filter") ?? "all", url.searchParams.get("cursor"));
  return Response.json(page, { headers: { "Cache-Control": "no-store" } });
}
