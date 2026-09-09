"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/api/client";
import { confirmDialog } from "@/components/ConfirmDialog";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  status: string;
  sent: number;
  sendAt: string | null;
}

interface DeliveryLogEntry {
  id: number;
  email: string;
  status: "sent" | "failed" | "bounced" | "undeliverable";
  error: string | null;
  sentAt: string;
}

interface CampaignStats {
  sent: number;
  retrying: number;
  undeliverable: number;
  bounced: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
}

const NEXT_STATUS: Record<string, string[]> = {
  draft: ["running"],
  scheduled: ["running", "cancelled"],
  running: ["paused", "cancelled"],
  paused: ["running", "cancelled"],
  finished: [],
  cancelled: [],
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  scheduled: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  paused: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  finished: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

const LOG_STATUS_STYLE: Record<string, string> = {
  sent: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  // Still within its retry budget — not final yet, distinct from undeliverable.
  failed: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  bounced: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  undeliverable: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [openLogId, setOpenLogId] = useState<number | null>(null);
  const [log, setLog] = useState<DeliveryLogEntry[] | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);

  async function load() {
    const { data } = await api.get("/campaigns");
    setCampaigns(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: number, status: string) {
    if (status === "running") {
      const { data } = await api.post(`/campaigns/${id}/preflight`);
      if (data.errors.length) {
        alert(`Can't send yet:\n\n${data.errors.join("\n")}`);
        return;
      }
      if (data.warnings.length) {
        const proceed = await confirmDialog(`${data.warnings.join("\n\n")}\n\nSend anyway?`);
        if (!proceed) return;
      }
    }
    await api.put(`/campaigns/${id}/status`, { status });
    await load();
  }

  async function toggleLog(id: number) {
    if (openLogId === id) {
      setOpenLogId(null);
      return;
    }
    setOpenLogId(id);
    setLog(null);
    setStats(null);
    const [logRes, statsRes] = await Promise.all([api.get(`/campaigns/${id}/delivery-log`), api.get(`/campaigns/${id}/stats`)]);
    setLog(logRes.data);
    setStats(statsRes.data);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Campaigns</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Letters you've sent, scheduled, or are still drafting.</p>
        </div>
        <Link href="/campaigns/new" className="btn">
          New letter
        </Link>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Send at</th>
              <th>Sent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <Fragment key={c.id}>
                <tr>
                  <td>{c.name}</td>
                  <td>{c.subject}</td>
                  <td>
                    <span className={`badge ${STATUS_STYLE[c.status]}`}>{c.status}</span>
                  </td>
                  <td>{c.sendAt ? new Date(c.sendAt).toLocaleString() : "—"}</td>
                  <td>{c.sent}</td>
                  <td className="flex gap-2">
                    {(NEXT_STATUS[c.status] ?? []).map((s) => (
                      <button key={s} onClick={() => setStatus(c.id, s)} className="btn-ghost">
                        {s === "running" ? "Send now" : s}
                      </button>
                    ))}
                    <button className="btn-ghost" onClick={() => toggleLog(c.id)}>
                      {openLogId === c.id ? "Hide log" : "Delivery log"}
                    </button>
                  </td>
                </tr>
                {openLogId === c.id && (
                  <tr>
                    <td colSpan={6} className="bg-slate-50 p-0 dark:bg-slate-900/60">
                      {stats && (
                        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-slate-200 px-4 py-3 text-sm dark:border-white/10">
                          <Stat label="Sent" value={stats.sent} />
                          <Stat label="Retrying" value={stats.retrying} />
                          <Stat label="Undeliverable" value={stats.undeliverable} />
                          <Stat label="Bounced" value={stats.bounced} />
                          <Stat label="Opens" value={stats.opens} />
                          <Stat label="Clicks" value={stats.clicks} />
                          <Stat label="Unsubscribes" value={stats.unsubscribes} />
                        </div>
                      )}
                      {!log ? (
                        <p className="px-4 py-3 text-sm text-slate-400">Loading…</p>
                      ) : log.length ? (
                        <table className="table-base">
                          <thead>
                            <tr>
                              <th>Email</th>
                              <th>Status</th>
                              <th>Error</th>
                              <th>When</th>
                            </tr>
                          </thead>
                          <tbody>
                            {log.map((entry) => (
                              <tr key={entry.id}>
                                <td>{entry.email}</td>
                                <td>
                                  <span className={`badge ${LOG_STATUS_STYLE[entry.status]}`}>{entry.status}</span>
                                </td>
                                <td className="max-w-xs truncate text-xs text-slate-500" title={entry.error ?? ""}>
                                  {entry.error ?? "—"}
                                </td>
                                <td>{new Date(entry.sentAt).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="px-4 py-3 text-sm text-slate-400">No sends recorded yet.</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!campaigns.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No letters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}
