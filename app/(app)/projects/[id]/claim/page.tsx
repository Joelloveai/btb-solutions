import { redirect } from "next/navigation";

/** The first claim export lived here; claims are now stored and managed under /claims. */
export default function LegacyClaimPage({ params }: { params: { id: string } }) {
  redirect(`/projects/${params.id}/claims`);
}
