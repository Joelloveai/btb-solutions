import { OfflineHome } from "@/components/offline/offline-home";

export const metadata = { title: "Offline · BTB Solutions" };

/**
 * Shown when a page that was never opened on this phone is requested with no signal.
 * It needs no sign-in: everything it shows comes from the phone's own storage.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">You are offline</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page was not saved on this phone. Pages you have opened before still work, and anything you add now is kept and
        sent when you are back online.
      </p>
      <OfflineHome />
    </main>
  );
}
