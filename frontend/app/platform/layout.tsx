"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PlatformAuthProvider, usePlatformAuth } from "@/auth/PlatformAuthContext";

function Guard({ children }: { children: React.ReactNode }) {
  const { admin, loading } = usePlatformAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/platform/login";

  useEffect(() => {
    if (loading) return;
    if (!admin && !isLoginPage) router.replace("/platform/login");
    if (admin && isLoginPage) router.replace("/platform");
  }, [loading, admin, isLoginPage, router]);

  if (loading) return null;
  if (!admin && !isLoginPage) return null;
  if (admin && isLoginPage) return null;
  return <>{children}</>;
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAuthProvider>
      <Guard>{children}</Guard>
    </PlatformAuthProvider>
  );
}
