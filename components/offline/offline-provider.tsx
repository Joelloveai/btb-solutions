"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getMeta, setMeta } from "@/lib/offline/db";
import { clearOfflineData } from "@/lib/offline/clear";
import { listOps, onOutboxChange } from "@/lib/offline/outbox";
import { drainOutbox } from "@/lib/offline/sync";

type OfflineState = {
  /** True only when the app can really reach the server, not merely when the phone claims to be online. */
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
  authNeeded: boolean;
  syncNow: () => Promise<void>;
};

const OfflineContext = createContext<OfflineState>({ online: true, pending: 0, failed: 0, syncing: false, authNeeded: false, syncNow: async () => undefined });
export const useOffline = () => useContext(OfflineContext);

const SW_ENABLED = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";
const HEARTBEAT_MS = 20_000;
const SYNC_RETRY_MS = 30_000;
const WARM_EVERY_MS = 30 * 60 * 1000;

async function reachable(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Keeps the app usable with no signal: registers the service worker, tracks real connectivity,
 * replays the queue of changes when the connection returns, and pre-loads the pages a person is
 * most likely to need so they are already on the phone when the signal drops.
 */
export function OfflineProvider({ userKey, warmUrls = [], children }: { userKey: string; warmUrls?: string[]; children: ReactNode }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [counts, setCounts] = useState({ pending: 0, failed: 0 });
  const [syncing, setSyncing] = useState(false);
  const [authNeeded, setAuthNeeded] = useState(false);
  const onlineRef = useRef(true);
  const warmRef = useRef(warmUrls);
  warmRef.current = warmUrls;

  const refreshCounts = useCallback(async () => {
    const ops = await listOps().catch(() => []);
    setCounts({ pending: ops.filter((o) => o.status === "pending").length, failed: ops.filter((o) => o.status === "failed").length });
  }, []);

  const syncNow = useCallback(async () => {
    if (!onlineRef.current) return;
    setSyncing(true);
    try {
      const summary = await drainOutbox();
      if (summary.skipped) return;
      setAuthNeeded(summary.authNeeded);
      if (summary.synced > 0) {
        toast.success(`${summary.synced} saved change${summary.synced === 1 ? "" : "s"} synced`);
        router.refresh();
      }
      if (summary.failed > 0) toast.error(`${summary.failed} change${summary.failed === 1 ? "" : "s"} could not be saved and need${summary.failed === 1 ? "s" : ""} attention`);
      if (summary.authNeeded) toast.error("Please sign in again to sync your changes.");
    } finally {
      setSyncing(false);
      void refreshCounts();
    }
  }, [refreshCounts, router]);

  // Who is signed in on this device? If it is someone new, remove the previous person's saved data first.
  useEffect(() => {
    (async () => {
      const owner = await getMeta<string>("owner");
      if (owner && owner !== userKey) await clearOfflineData();
      await setMeta("owner", userKey);
      void refreshCounts();
    })().catch(() => undefined);
  }, [userKey, refreshCounts]);

  // Service worker.
  useEffect(() => {
    if (!SW_ENABLED || !("serviceWorker" in navigator)) return;
    const mode = process.env.NODE_ENV === "production" ? "prod" : "dev";
    navigator.serviceWorker.register(`/sw.js?mode=${mode}`, { scope: "/" }).catch(() => undefined);
  }, []);

  // Real connectivity.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ok = await reachable();
      if (cancelled) return;
      const was = onlineRef.current;
      onlineRef.current = ok;
      setOnline(ok);
      if (ok && !was) void syncNow();
    };
    const goOffline = () => {
      onlineRef.current = false;
      setOnline(false);
    };
    window.addEventListener("online", check);
    window.addEventListener("offline", goOffline);
    const interval = setInterval(check, HEARTBEAT_MS);
    void check();
    return () => {
      cancelled = true;
      window.removeEventListener("online", check);
      window.removeEventListener("offline", goOffline);
      clearInterval(interval);
    };
  }, [syncNow]);

  // Queue changes -> counts, and keep retrying while anything is waiting.
  useEffect(() => onOutboxChange(() => void refreshCounts()), [refreshCounts]);
  useEffect(() => {
    if (counts.pending === 0) return;
    const interval = setInterval(() => void syncNow(), SYNC_RETRY_MS);
    return () => clearInterval(interval);
  }, [counts.pending, syncNow]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && counts.pending > 0 && void syncNow();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [counts.pending, syncNow]);

  // Pre-load the likely pages (once per half hour) so they are cached before the signal drops.
  useEffect(() => {
    if (!SW_ENABLED || !online || !("serviceWorker" in navigator)) return;
    const key = `btb-warm-${userKey}`;
    try {
      if (Date.now() - Number(localStorage.getItem(key) ?? 0) < WARM_EVERY_MS) return;
    } catch {
      /* storage unavailable: just warm */
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      await navigator.serviceWorker.ready;
      for (const url of warmRef.current) {
        if (cancelled || !onlineRef.current) return;
        await fetch(url, { headers: { Accept: "text/html" }, credentials: "same-origin" }).catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      try {
        localStorage.setItem(key, String(Date.now()));
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [online, userKey]);

  return <OfflineContext.Provider value={{ online, syncing, authNeeded, syncNow, ...counts }}>{children}</OfflineContext.Provider>;
}
