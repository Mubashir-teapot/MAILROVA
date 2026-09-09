"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";

interface Domain {
  id: number;
  domain: string;
  dkimSelector: string;
  maxDailyCap: number;
  todaysCap: number;
  sentToday: number;
}

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  note?: string;
}

export default function Domains() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [records, setRecords] = useState<{ ready: boolean; records: DnsRecord[] } | null>(null);

  async function load() {
    const { data } = await api.get("/domains");
    setDomains(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await api.post("/domains", { domain: name });
      setName("");
      await load();
      openRecords(data.id);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to add domain");
    }
  }

  async function openRecords(id: number) {
    setOpenId(id);
    setRecords(null);
    const { data } = await api.get(`/domains/${id}/dns-records`);
    setRecords(data);
  }

  async function refreshRecords(id: number) {
    const { data } = await api.get(`/domains/${id}/dns-records`);
    setRecords(data);
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Remove this domain? Mailboxes on it will stop working."))) return;
    await api.delete(`/domains/${id}`);
    if (openId === id) setOpenId(null);
    await load();
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="page-title">Sending domains</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add a domain to send from. We generate the DKIM key and give you every record to paste into Cloudflare.
        </p>
      </div>

      <form onSubmit={handleAdd} className="card flex flex-wrap items-end gap-3">
        <label className="label">
          Domain
          <input
            className="input"
            placeholder="marketing.yourdomain.com"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn">
          Add domain
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-3">
        {domains.map((d) => (
          <div key={d.id} className="card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{d.domain}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Warmup: {d.sentToday} / {d.todaysCap} sent today (cap ramps up daily, max {d.maxDailyCap}/day)
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => (openId === d.id ? setOpenId(null) : openRecords(d.id))}>
                  {openId === d.id ? "Hide records" : "DNS records"}
                </button>
                <button onClick={() => handleDelete(d.id)} className="text-slate-400 hover:text-red-600" aria-label="Delete">
                  <TrashIcon />
                </button>
              </div>
            </div>

            {openId === d.id && (
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                {!records ? (
                  <p className="text-sm text-slate-400">Loading…</p>
                ) : (
                  <>
                    {!records.ready && (
                      <div className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                        DKIM key is still generating (mail server is restarting) — refresh in a few seconds.
                        <button className="btn-ghost" onClick={() => refreshRecords(d.id)}>
                          Refresh
                        </button>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="table-base">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Name</th>
                            <th>Value</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {records.records.map((r, i) => (
                            <tr key={i}>
                              <td>{r.type}</td>
                              <td className="font-mono text-xs">{r.name}</td>
                              <td className="max-w-md truncate font-mono text-xs" title={r.value}>
                                {r.value}
                              </td>
                              <td>
                                <button className="btn-ghost" onClick={() => copy(r.value)}>
                                  Copy
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-400">
                      One more thing DNS can't do: set reverse DNS (PTR) for your server's IP to match this domain/hostname —
                      that's done in your hosting provider's panel (Hostinger), not Cloudflare.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
        {!domains.length && <p className="text-sm text-slate-400">No domains yet.</p>}
      </div>
    </div>
  );
}
