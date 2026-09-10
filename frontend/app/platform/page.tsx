"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { usePlatformAuth } from "@/auth/PlatformAuthContext";
import { LogoMark } from "@/components/Logo";
import { CloseIcon, LogoutIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Tenant {
  id: number;
  name: string;
  slug: string;
  status: "active" | "suspended";
  hostnames: { id: number; hostname: string; isPrimary: boolean }[];
  _count: { users: number; domains: number };
}

export default function PlatformDashboard() {
  const { admin, logout } = usePlatformAuth();

  const [schedulerMs, setSchedulerMs] = useState(30000);
  const [savingScheduler, setSavingScheduler] = useState(false);
  const [schedulerSaved, setSchedulerSaved] = useState(false);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantForm, setTenantForm] = useState({
    name: "",
    slug: "",
    hostname: "",
    adminUsername: "admin",
    adminEmail: "",
    adminPassword: "",
  });
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [newHostname, setNewHostname] = useState<Record<number, string>>({});

  function loadSettings() {
    api.get("/platform/settings").then(({ data }) => {
      if (typeof data.campaign_scheduler_interval_ms === "number") setSchedulerMs(data.campaign_scheduler_interval_ms);
    });
  }

  function loadTenants() {
    api.get("/platform/tenants").then(({ data }) => setTenants(data));
  }

  useEffect(() => {
    loadSettings();
    loadTenants();
  }, []);

  async function handleSaveScheduler(e: FormEvent) {
    e.preventDefault();
    setSavingScheduler(true);
    setSchedulerSaved(false);
    try {
      await api.put("/platform/settings", { campaign_scheduler_interval_ms: schedulerMs });
      setSchedulerSaved(true);
    } finally {
      setSavingScheduler(false);
    }
  }

  async function handleCreateTenant(e: FormEvent) {
    e.preventDefault();
    setTenantError(null);
    try {
      await api.post("/platform/tenants", tenantForm);
      setTenantForm({ name: "", slug: "", hostname: "", adminUsername: "admin", adminEmail: "", adminPassword: "" });
      loadTenants();
    } catch (err: any) {
      setTenantError(err.response?.data?.error ?? "Failed to create tenant");
    }
  }

  async function toggleStatus(tenant: Tenant) {
    const status = tenant.status === "active" ? "suspended" : "active";
    await api.put(`/platform/tenants/${tenant.id}/status`, { status });
    loadTenants();
  }

  async function addHostname(tenantId: number) {
    const hostname = newHostname[tenantId]?.trim();
    if (!hostname) return;
    await api.post(`/platform/tenants/${tenantId}/hostnames`, { hostname });
    setNewHostname((h) => ({ ...h, [tenantId]: "" }));
    loadTenants();
  }

  async function removeHostname(hostnameId: number) {
    await api.delete(`/platform/tenants/hostnames/${hostnameId}`);
    loadTenants();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="text-sm font-semibold text-foreground">Mailrova Platform</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{admin?.username}</span>
          <button onClick={logout} className="flex items-center gap-1 hover:text-foreground">
            <LogoutIcon width={14} height={14} />
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
        <div>
          <h2 className="page-title">Platform settings</h2>
          <p className="text-sm text-muted-foreground">Applies across every tenant on this deployment.</p>
        </div>

        <Card className="p-5">
          <form onSubmit={handleSaveScheduler} className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">Campaign scheduler</h3>
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="scheduler-ms">Poll interval (ms)</Label>
              <Input
                id="scheduler-ms"
                type="number"
                min={1000}
                step={1000}
                value={schedulerMs}
                onChange={(e) => setSchedulerMs(Number(e.target.value))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              How often the scheduler checks for scheduled/running campaigns across all tenants. Takes effect on the
              next tick. No restart needed.
            </p>
            {schedulerSaved && <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved.</p>}
            <Button type="submit" className="w-fit" disabled={savingScheduler}>
              {savingScheduler ? "Saving…" : "Save"}
            </Button>
          </form>
        </Card>

        <div>
          <h2 className="page-title">Tenants</h2>
          <p className="text-sm text-muted-foreground">Each tenant is a fully isolated organization.</p>
        </div>

        <Card className="p-5">
          <form onSubmit={handleCreateTenant} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-name">Org name</Label>
              <Input
                id="t-name"
                value={tenantForm.name}
                onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-slug">Slug</Label>
              <Input
                id="t-slug"
                value={tenantForm.slug}
                onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-hostname">Hostname</Label>
              <Input
                id="t-hostname"
                placeholder="mail.example.com"
                value={tenantForm.hostname}
                onChange={(e) => setTenantForm({ ...tenantForm, hostname: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-admin-username">Admin username</Label>
              <Input
                id="t-admin-username"
                value={tenantForm.adminUsername}
                onChange={(e) => setTenantForm({ ...tenantForm, adminUsername: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-admin-email">Admin email</Label>
              <Input
                id="t-admin-email"
                type="email"
                value={tenantForm.adminEmail}
                onChange={(e) => setTenantForm({ ...tenantForm, adminEmail: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="t-admin-password">Admin password</Label>
              <Input
                id="t-admin-password"
                type="password"
                value={tenantForm.adminPassword}
                onChange={(e) => setTenantForm({ ...tenantForm, adminPassword: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <Button type="submit">Create tenant</Button>
            {tenantError && <p className="w-full text-sm text-destructive">{tenantError}</p>}
          </form>
        </Card>

        <div className="flex flex-col gap-3">
          {tenants.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {t.name} <span className="text-muted-foreground">({t.slug})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t._count.users} users · {t._count.domains} domains
                  </p>
                </div>
                <button onClick={() => toggleStatus(t)}>
                  <Badge variant={t.status === "active" ? "success" : "destructive"}>
                    {t.status}, click to {t.status === "active" ? "suspend" : "activate"}
                  </Badge>
                </button>
              </div>

              <div>
                <Label className="mb-2 inline-block">Hostnames</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {t.hostnames.map((h) => (
                    <span
                      key={h.id}
                      className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {h.hostname}
                      {h.isPrimary && <span className="text-muted-foreground/70">(primary)</span>}
                      {!h.isPrimary && (
                        <button onClick={() => removeHostname(h.id)} className="text-muted-foreground hover:text-destructive">
                          <CloseIcon width={11} height={11} />
                        </button>
                      )}
                    </span>
                  ))}
                  <Input
                    className="h-7 w-40 text-xs"
                    placeholder="add hostname…"
                    value={newHostname[t.id] ?? ""}
                    onChange={(e) => setNewHostname((h) => ({ ...h, [t.id]: e.target.value }))}
                  />
                  <Button variant="outline" size="sm" onClick={() => addHostname(t.id)}>
                    Add
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {!tenants.length && <p className="text-sm text-muted-foreground">No tenants yet.</p>}
        </div>
      </main>
    </div>
  );
}
