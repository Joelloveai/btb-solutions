"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type SidebarState = { collapsed: boolean; toggleCollapsed: () => void; mobileOpen: boolean; setMobileOpen: (open: boolean) => void };

const SidebarContext = createContext<SidebarState | null>(null);
const KEY = "btb-sidebar-collapsed";

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Remember the desktop choice; storage can be unavailable (private mode), so never depend on it.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      try {
        localStorage.setItem(KEY, current ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !current;
    });
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
