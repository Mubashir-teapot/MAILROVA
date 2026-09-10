"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useTheme } from "@/theme/ThemeContext";
import { useSidebar } from "@/sidebar/SidebarContext";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";
import { ConfirmDialogHost } from "./ConfirmDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  AtSignIcon,
  AuditLogIcon,
  BlockIcon,
  BounceIcon,
  CampaignIcon,
  DashboardIcon,
  GlobeIcon,
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

// `permissions` mirrors exactly what each page's backend routes require
// (see each module's *.routes.ts requirePermission(...) call) — a user
// needs ANY one of the listed permissions to see the link at all.
// `undefined` means always visible to any logged-in user (just Dashboard).
const NAV = [
  { to: "/", label: "Dashboard", icon: DashboardIcon },
  { to: "/subscribers", label: "Subscribers", icon: UsersIcon, permissions: ["subscribers:get_all", "subscribers:manage"] },
  { to: "/lists", label: "Lists", icon: ListIcon, permissions: ["lists:get_all", "lists:manage_all"] },
  { to: "/import", label: "Import", icon: UploadIcon, permissions: ["subscribers:import"] },
  { to: "/campaigns", label: "Campaigns", icon: CampaignIcon, permissions: ["campaigns:get_all", "campaigns:manage_all"] },
  { to: "/templates", label: "Templates", icon: TemplateIcon, permissions: ["templates:get", "templates:manage"] },
  { to: "/media", label: "Media", icon: MediaIcon, permissions: ["media:get", "media:manage"] },
  { to: "/bounces", label: "Bounces", icon: BounceIcon, permissions: ["bounces:get", "bounces:manage"] },
  { to: "/suppressions", label: "Suppressions", icon: BlockIcon, permissions: ["bounces:get", "bounces:manage"] },
  { to: "/domains", label: "Domains", icon: GlobeIcon, permissions: ["settings:get", "settings:manage"] },
  { to: "/mailboxes", label: "Mailboxes", icon: AtSignIcon, permissions: ["users:get", "users:manage"] },
  { to: "/users", label: "Users", icon: UsersIcon, permissions: ["users:get", "users:manage"] },
  { to: "/roles", label: "Roles", icon: RoleIcon, permissions: ["roles:get", "roles:manage"] },
  { to: "/audit-log", label: "Audit Log", icon: AuditLogIcon, permissions: ["audit:get"] },
  { to: "/settings", label: "Settings", icon: SettingsIcon, permissions: ["settings:get", "settings:manage"] },
] satisfies { to: string; label: string; icon: typeof DashboardIcon; permissions?: string[] }[];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { collapsed, toggle: toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "flex flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <LogoMark />
            {!collapsed && <span className="truncate text-[15px] font-semibold tracking-tight">Mailrova</span>}
          </div>
          <button
            onClick={toggleSidebar}
            className="shrink-0 rounded-md p-1 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.filter((n) => !n.permissions || n.permissions.some((p) => user?.permissions?.includes(p))).map((n) => {
            const isActive = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const link = (
              <Link
                key={n.to}
                href={n.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  collapsed && "justify-center",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <n.icon className="shrink-0" />
                {!collapsed && n.label}
              </Link>
            );
            if (!collapsed) return link;
            return (
              <Tooltip key={n.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{n.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
        <div className="flex flex-col gap-2 border-t border-sidebar-border pt-3">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  className="flex items-center justify-center rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  {theme === "dark" ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={toggle}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {theme === "dark" ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center rounded-md px-2.5 py-2 text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
                  aria-label="Logout"
                >
                  <LogoutIcon width={14} height={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout ({user?.username})</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center justify-between px-2.5 text-xs">
              <span className="truncate text-sidebar-foreground/60">{user?.username}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded px-1 py-1 text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
              >
                <LogoutIcon width={14} height={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <ConfirmDialogHost />
    </div>
  );
}
