"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/auth/AuthContext";
import { Layout } from "@/components/Layout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/admin/login");
  }, [loading, user, router]);

  // middleware.ts already redirects at the edge for the common case; this is
  // the client-side fallback (e.g. a cookie that middleware saw but the
  // backend then rejected) so the sidebar never renders for a logged-out user.
  if (loading || !user) return null;

  return <Layout>{children}</Layout>;
}
