import { getServerSession } from "next-auth";
import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">Settings</h1>
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <p className="text-sm text-gray-500">Signed in as</p>
          <p className="font-semibold">{session?.user?.email}</p>
        </div>
        <SignOutButton />
      </div>
    </>
  );
}
