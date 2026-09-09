"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";

interface Domain {
  id: number;
  domain: string;
}

interface UserOption {
  id: number;
  username: string;
}

interface Mailbox {
  id: number;
  email: string;
  name: string;
  enabled: boolean;
  dailyCap: number;
  domain: Domain;
  users: { user: UserOption }[];
}

export default function Mailboxes() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [form, setForm] = useState({ domainId: "", email: "", name: "", password: "", dailyCap: "100" });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [{ data: mb }, { data: doms }, { data: us }] = await Promise.all([
      api.get("/mailboxes"),
      api.get("/domains"),
      api.get("/users"),
    ]);
    setMailboxes(mb);
    setDomains(doms);
    setUsers(us);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/mailboxes", {
        domainId: Number(form.domainId),
        email: form.email,
        name: form.name,
        password: form.password || undefined,
        dailyCap: Number(form.dailyCap) || 100,
      });
      setForm({ domainId: form.domainId, email: "", name: "", password: "", dailyCap: "100" });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to create mailbox");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this mailbox?")) return;
    await api.delete(`/mailboxes/${id}`);
    await load();
  }

  async function toggleEnabled(mailbox: Mailbox) {
    await api.put(`/mailboxes/${mailbox.id}/enabled`, { enabled: !mailbox.enabled });
    await load();
  }

  async function changePassword(id: number) {
    const password = prompt("New password (min 8 characters):");
    if (!password) return;
    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    await api.put(`/mailboxes/${id}/password`, { password });
  }

  async function changeCap(id: number, current: number) {
    const value = prompt("Daily send limit for this mailbox:", String(current));
    if (!value) return;
    await api.put(`/mailboxes/${id}/daily-cap`, { dailyCap: Number(value) });
    await load();
  }

  async function toggleUser(mailbox: Mailbox, userId: number) {
    const current = mailbox.users.map((u) => u.user.id);
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    await api.put(`/mailboxes/${mailbox.id}/users`, { userIds: next });
    await load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="page-title">Mailboxes</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sending accounts on your verified domains — e.g. info@ or sales@ — with their own password, daily limit, and
          user access.
        </p>
      </div>

      <form onSubmit={handleCreate} className="card flex flex-wrap items-end gap-3">
        <label className="label">
          Domain
          <select className="input" value={form.domainId} onChange={(e) => setForm({ ...form, domainId: e.target.value })} required>
            <option value="">Select a domain…</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.domain}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Email
          <input
            className="input"
            placeholder="info@marketing.yourdomain.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label className="label">
          Display name
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label className="label">
          Password (optional, for SMTP-AUTH)
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <label className="label w-28">
          Daily limit
          <input
            type="number"
            className="input"
            value={form.dailyCap}
            onChange={(e) => setForm({ ...form, dailyCap: e.target.value })}
          />
        </label>
        <button type="submit" className="btn" disabled={!domains.length}>
          Add mailbox
        </button>
        {!domains.length && <p className="text-xs text-slate-400">Add a domain first.</p>}
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-3">
        {mailboxes.map((mailbox) => (
          <div key={mailbox.id} className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {mailbox.name} <span className="text-slate-400">&lt;{mailbox.email}&gt;</span>{" "}
                  <span className={`badge ${mailbox.enabled ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                    {mailbox.enabled ? "enabled" : "disabled"}
                  </span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {mailbox.domain.domain} · {mailbox.dailyCap} emails/day
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => changeCap(mailbox.id, mailbox.dailyCap)}>
                  Set limit
                </button>
                <button className="btn-ghost" onClick={() => changePassword(mailbox.id)}>
                  Set password
                </button>
                <button className="btn-ghost" onClick={() => toggleEnabled(mailbox)}>
                  {mailbox.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => handleDelete(mailbox.id)} className="text-slate-400 hover:text-red-600" aria-label="Delete">
                  <TrashIcon />
                </button>
              </div>
            </div>
            <div>
              <span className="label mb-2">Assigned users</span>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => {
                  const assigned = mailbox.users.some((iu) => iu.user.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(mailbox, u.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs ${
                        assigned
                          ? "border-accent bg-blue-50 text-accent dark:bg-blue-500/10"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {u.username}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        {!mailboxes.length && <p className="text-sm text-slate-400">No mailboxes yet.</p>}
      </div>
    </div>
  );
}
