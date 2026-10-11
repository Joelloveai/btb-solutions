"use client";

import { signOut } from "next-auth/react";
import { clearOfflineData, confirmSignOut } from "@/lib/offline/clear";
import { useOffline } from "./offline-provider";

/**
 * Sign out without leaving private data behind on a shared phone: sends anything still waiting
 * (or warns first), then erases the saved pages, photos and queue from this device.
 */
export function useSafeSignOut() {
  const { syncNow } = useOffline();
  return async (callbackUrl: string) => {
    if (!(await confirmSignOut(syncNow))) return;
    await clearOfflineData();
    await signOut({ callbackUrl });
  };
}
