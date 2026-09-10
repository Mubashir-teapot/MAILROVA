"use client";

import { ReactNode } from "react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { AuthProvider } from "@/auth/AuthContext";
import { SidebarProvider } from "@/sidebar/SidebarContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} />;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </AuthProvider>
      </SidebarProvider>
      <ThemedToaster />
    </ThemeProvider>
  );
}
