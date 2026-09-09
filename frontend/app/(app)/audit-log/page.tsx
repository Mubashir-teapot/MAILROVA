"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { EmptyState, Loading } from "@/components/States";

interface AuditLogEntry {
  id: number;
  actorType: string;
  actorLabel: string;
  action: string;
  targetType: string | null;
  targetId: number | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

const ACTOR_LABEL: Record<string, string> = {
  user: "User",
  platform_admin: "Platform admin",
  api_key: "API key",
};

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/audit-logs")
      .then(({ data }) => setEntries(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="page-title">Audit Log</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Important admin and user actions in this tenant — user/role changes, domain and mailbox
        changes, campaign sends, settings changes, and API key activity.
      </p>

      {loading ? (
        <Loading />
      ) : entries.length === 0 ? (
        <div className="card">
          <EmptyState message="Nothing logged yet." />
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                  <td>
                    {ACTOR_LABEL[e.actorType] ?? e.actorType}: {e.actorLabel}
                  </td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">{e.action}</span>
                  </td>
                  <td>{e.targetType ? `${e.targetType} #${e.targetId}` : "—"}</td>
                  <td className="max-w-sm truncate text-xs text-slate-500 dark:text-slate-400" title={JSON.stringify(e.meta)}>
                    {Object.keys(e.meta ?? {}).length ? JSON.stringify(e.meta) : "—"}
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
