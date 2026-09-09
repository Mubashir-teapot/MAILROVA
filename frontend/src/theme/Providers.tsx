"use client";

import { ReactNode } from "react";
import { ThemeProvider } from "./ThemeContext";
import { AuthProvider } from "@/auth/AuthContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
