import { findSubInvite } from "@/app/actions";
import { JoinForm } from "@/components/portal/join-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Where a subcontractor lands from the WhatsApp invite: choose a PIN and they are in. No email, no password. */
export default async function JoinPage({ params }: { params: { token: string } }) {
  const invite = await findSubInvite(params.token);
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center space-y-2 p-6 pb-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="BTB Solutions" className="h-12 w-12" />
          <h1 className="text-xl font-semibold tracking-tight">Welcome to BTB</h1>
          <p className="text-sm text-muted-foreground">{invite ? "Set up your login in under a minute." : ""}</p>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-2">
          {invite ? (
            <JoinForm token={params.token} initialName={invite.name} initialTrade={invite.trade} phone={invite.phone} />
          ) : (
            <p role="alert" className="text-center text-sm">
              This invite link has expired or was already used. Please ask BTB Builders to send you a new one.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
