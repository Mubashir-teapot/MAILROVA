"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, Loading } from "@/components/States";

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/api-keys");
      setKeys(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await api.post("/api-keys", { name });
      setFreshKey(data.key);
      setCopied(false);
      setName("");
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to create key");
    }
  }

  async function handleRevoke(id: number) {
    if (!(await confirmDialog("Revoke this API key? Anything using it will stop working immediately."))) return;
    await api.delete(`/api-keys/${id}`);
    await load();
  }

  function copyKey() {
    if (!freshKey) return;
    navigator.clipboard.writeText(freshKey).then(() => setCopied(true));
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="page-title">API Keys</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        For programmatic access — send <code>Authorization: Bearer &lt;key&gt;</code> instead of
        logging in. Each key has the same permissions as the user who created it.
      </p>

      {freshKey && (
        <div className="card flex flex-col gap-2 border border-accent/40 bg-accent/5">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Copy this key now — it won&apos;t be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-slate-900 px-3 py-2 text-xs text-white">{freshKey}</code>
            <button type="button" className="btn-ghost" onClick={copyKey}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button type="button" className="self-start text-xs text-slate-500 hover:underline dark:text-slate-400" onClick={() => setFreshKey(null)}>
            Done
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="card flex flex-wrap items-end gap-3">
        <label className="label">
          Name
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CI script" />
        </label>
        <button type="submit" className="btn">
          Create key
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <Loading />
      ) : keys.length === 0 ? (
        <div className="card">
          <EmptyState message="No API keys yet." />
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Last used</th>
                <th>Created</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td>
                    <code className="text-xs">mrv_{k.keyPrefix}…</code>
                  </td>
                  <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</td>
                  <td>{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td>
                    {k.revokedAt ? (
                      <span className="badge bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">Revoked</span>
                    ) : (
                      <span className="badge bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">Active</span>
                    )}
                  </td>
                  <td className="w-10">
                    {!k.revokedAt && (
                      <button onClick={() => handleRevoke(k.id)} className="text-slate-400 hover:text-red-600" aria-label="Revoke">
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
