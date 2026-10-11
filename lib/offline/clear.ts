import { wipeLocalData } from "./db";
import { listOps } from "./outbox";

/**
 * Remove everything this app keeps on the device for the current person: the queued changes,
 * the saved project data, and every cached page and photo. Called on sign-out and whenever a
 * different person signs in on the same phone, so one person's data is never left for the next.
 */
export async function clearOfflineData() {
  await wipeLocalData().catch(() => undefined);
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith("btb-")).map((key) => caches.delete(key)));
    }
    const registration = await navigator.serviceWorker?.getRegistration();
    registration?.active?.postMessage("CLEAR_CACHES");
  } catch {
    /* best effort */
  }
}

/** Sign-out guard: warns if changes made with no signal have not synced yet. Returns false to cancel. */
export async function confirmSignOut(syncFirst: () => Promise<void>): Promise<boolean> {
  try {
    await syncFirst();
  } catch {
    /* offline: fall through to the warning */
  }
  const waiting = (await listOps().catch(() => [])).length;
  if (waiting === 0) return true;
  return window.confirm(
    `${waiting} change${waiting === 1 ? " is" : "s are"} still waiting to sync from this phone. Signing out now will lose ${waiting === 1 ? "it" : "them"}. Sign out anyway?`,
  );
}
