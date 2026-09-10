"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme/ThemeContext";
import { LogoMark } from "./Logo";
import { ConfirmDialogHost } from "./ConfirmDialog";
import {
  AtSignIcon,
  AuditLogIcon,
  BlockIcon,
  BounceIcon,
  CampaignIcon,
  DashboardIcon,
  GlobeIcon,
  KeyIcon,
  ListIcon,
  LogoutIcon,
  MediaIcon,
  MoonIcon,
  RoleIcon,
  SettingsIcon,
  SunIcon,
  TemplateIcon,
  UploadIcon,
  UsersIcon,
} from "./icons";

const NAV = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/subscribers", label: "Subscribers", icon: UsersIcon },
  { to: "/lists", label: "Lists", icon: ListIcon },
  { to: "/import", label: "Import", icon: UploadIcon },
  { to: "/campaigns", label: "Campaigns", icon: CampaignIcon },
  { to: "/templates", label: "Templates", icon: TemplateIcon },
  { to: "/media", label: "Media", icon: MediaIcon },
  { to: "/bounces", label: "Bounces", icon: BounceIcon },
  { to: "/suppressions", label: "Suppressions", icon: BlockIcon },
  { to: "/domains", label: "Domains", icon: GlobeIcon },
  { to: "/mailboxes", label: "Mailboxes", icon: AtSignIcon },
  { to: "/users", label: "Users", icon: UsersIcon },
  { to: "/roles", label: "Roles", icon: RoleIcon },
  { to: "/api-keys", label: "API Keys", icon: KeyIcon },
  { to: "/audit-log", label: "Audit Log", icon: AuditLogIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="flex w-56 flex-col gap-6 bg-ink p-4 text-white">
        <div className="flex items-center gap-2 px-1">
          <LogoMark forceDark />
          <span className="text-[15px] font-semibold tracking-tight">Mailrova</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((n) => {
            const isActive = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                href={n.to}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                  isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <n.icon />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
          <button
            onClick={toggle}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          >
            {theme === "dark" ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="flex items-center justify-between px-2.5 text-xs">
            <span className="truncate text-slate-400">{user?.username}</span>
            <button onClick={handleLogout} className="flex items-center gap-1 rounded px-1 py-1 text-slate-400 hover:text-white">
              <LogoutIcon width={14} height={14} />
              Logout
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <ConfirmDialogHost />
    </div>
  );
}
