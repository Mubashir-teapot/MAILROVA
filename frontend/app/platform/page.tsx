"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { usePlatformAuth } from "@/auth/PlatformAuthContext";
import { LogoMark } from "@/components/Logo";
import { CloseIcon, LogoutIcon } from "@/components/icons";

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Mailrova Platform</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>{admin?.username}</span>
          <button onClick={logout} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
            <LogoutIcon width={14} height={14} />
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
        <div>
          <h2 className="page-title">Platform settings</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Applies across every tenant on this deployment.</p>
        </div>

        <form onSubmit={handleSaveScheduler} className="card flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Campaign scheduler</h3>
          <label className="label max-w-xs">
            Poll interval (ms)
            <input
              type="number"
              min={1000}
              step={1000}
              className="input"
              value={schedulerMs}
              onChange={(e) => setSchedulerMs(Number(e.target.value))}
            />
          </label>
          <p className="text-xs text-slate-400">
            How often the scheduler checks for scheduled/running campaigns across all tenants. Takes effect on the
            next tick — no restart needed.
          </p>
          {schedulerSaved && <p className="text-xs text-green-600">Saved.</p>}
          <button type="submit" className="btn w-fit" disabled={savingScheduler}>
            {savingScheduler ? "Saving…" : "Save"}
          </button>
        </form>

        <div>
          <h2 className="page-title">Tenants</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Each tenant is a fully isolated organization.</p>
        </div>

        <form onSubmit={handleCreateTenant} className="card flex flex-wrap items-end gap-3">
          <label className="label">
            Org name
            <input
              className="input"
              value={tenantForm.name}
              onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
              required
            />
          </label>
          <label className="label">
            Slug
            <input
              className="input"
              value={tenantForm.slug}
              onChange={(e) => setTenantForm({ ...tenantForm, slug: e.target.value })}
              required
            />
          </label>
          <label className="label">
            Hostname
            <input
              className="input"
              placeholder="mail.example.com"
              value={tenantForm.hostname}
              onChange={(e) => setTenantForm({ ...tenantForm, hostname: e.target.value })}
              required
            />
          </label>
          <label className="label">
            Admin username
            <input
              className="input"
              value={tenantForm.adminUsername}
              onChange={(e) => setTenantForm({ ...tenantForm, adminUsername: e.target.value })}
              required
            />
          </label>
          <label className="label">
            Admin email
            <input
              type="email"
              className="input"
              value={tenantForm.adminEmail}
              onChange={(e) => setTenantForm({ ...tenantForm, adminEmail: e.target.value })}
              required
            />
          </label>
          <label className="label">
            Admin password
            <input
              type="password"
              className="input"
              value={tenantForm.adminPassword}
              onChange={(e) => setTenantForm({ ...tenantForm, adminPassword: e.target.value })}
              required
              minLength={8}
            />
          </label>
          <button type="submit" className="btn">
            Create tenant
          </button>
          {tenantError && <p className="w-full text-sm text-red-600">{tenantError}</p>}
        </form>

        <div className="flex flex-col gap-3">
          {tenants.map((t) => (
            <div key={t.id} className="card flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {t.name} <span className="text-slate-400">({t.slug})</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t._count.users} users · {t._count.domains} domains
                  </p>
                </div>
                <button
                  onClick={() => toggleStatus(t)}
                  className={`badge ${
                    t.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                  }`}
                >
                  {t.status} — click to {t.status === "active" ? "suspend" : "activate"}
                </button>
              </div>

              <div>
                <span className="label mb-2">Hostnames</span>
                <div className="flex flex-wrap items-center gap-2">
                  {t.hostnames.map((h) => (
                    <span
                      key={h.id}
                      className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {h.hostname}
                      {h.isPrimary && <span className="text-slate-400">(primary)</span>}
                      {!h.isPrimary && (
                        <button onClick={() => removeHostname(h.id)} className="text-slate-400 hover:text-red-600">
                          <CloseIcon width={11} height={11} />
                        </button>
                      )}
                    </span>
                  ))}
                  <input
                    className="input h-7 w-40 text-xs"
                    placeholder="add hostname…"
                    value={newHostname[t.id] ?? ""}
                    onChange={(e) => setNewHostname((h) => ({ ...h, [t.id]: e.target.value }))}
                  />
                  <button className="btn-ghost" onClick={() => addHostname(t.id)}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!tenants.length && <p className="text-sm text-slate-400">No tenants yet.</p>}
        </div>
      </main>
    </div>
  );
}
