"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api } from "@/api/client";

interface PlatformAdmin {
  id: number;
  username: string;
}

interface PlatformAuthContextValue {
  admin: PlatformAdmin | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/platform/me")
      .then(({ data }) => setAdmin(data))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const { data } = await api.post("/platform/login", { username, password });
    setAdmin(data);
  }

  async function logout() {
    await api.post("/platform/logout").catch(() => undefined);
    setAdmin(null);
  }

  return <PlatformAuthContext.Provider value={{ admin, loading, login, logout }}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
