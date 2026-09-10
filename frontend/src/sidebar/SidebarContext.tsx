"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("mailrova_sidebar_collapsed") === "1";
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Only affects one already-client-rendered component after the auth gate
  // resolves, not full-page paint — unlike theme, no blocking script is
  // needed to avoid a flash.
  useEffect(() => {
    setCollapsed(getInitialCollapsed());
  }, []);

  useEffect(() => {
    localStorage.setItem("mailrova_sidebar_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  function toggle() {
    setCollapsed((c) => !c);
  }

  return <SidebarContext.Provider value={{ collapsed, toggle }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
