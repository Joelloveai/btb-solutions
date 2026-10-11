import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { buildTimelinePack } from "@/lib/evidence-pack";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** "Export Evidence Pack": the project's timeline, photos and hash-chain verification as one PDF. Staff only. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return new Response("Not signed in", { status: 401 });
  const pack = await buildTimelinePack(params.id, session?.user?.name ?? session?.user?.email ?? "staff");
  if (!pack) return new Response("Not found", { status: 404 });
  const safeName = pack.project.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-") || "project";
  return new Response(new Uint8Array(pack.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="evidence-pack-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
