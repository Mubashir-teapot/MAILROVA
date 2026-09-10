"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { EmptyState, Loading } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <p className="text-sm text-muted-foreground">
        Important admin and user actions in this tenant — user/role changes, domain and mailbox
        changes, campaign sends, settings changes, and API key activity.
      </p>

      {loading ? (
        <Loading />
      ) : entries.length === 0 ? (
        <Card className="p-5">
          <EmptyState message="Nothing logged yet." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {ACTOR_LABEL[e.actorType] ?? e.actorType}: {e.actorLabel}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{e.action}</Badge>
                  </TableCell>
                  <TableCell>{e.targetType ? `${e.targetType} #${e.targetId}` : "—"}</TableCell>
                  <TableCell className="max-w-sm truncate text-xs text-muted-foreground" title={JSON.stringify(e.meta)}>
                    {Object.keys(e.meta ?? {}).length ? JSON.stringify(e.meta) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
