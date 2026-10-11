export const dynamic = "force-dynamic";

/** The app pings this to tell real connectivity from a phone that merely thinks it is online. */
export function GET() {
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}
