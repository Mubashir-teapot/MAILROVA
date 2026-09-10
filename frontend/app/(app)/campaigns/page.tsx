"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/api/client";
import { confirmDialog } from "@/components/ConfirmDialog";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  draft: "secondary",
  scheduled: "warning",
  running: "info",
  paused: "warning",
  finished: "success",
  cancelled: "destructive",
};

const LOG_STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  sent: "success",
  // Still within its retry budget — not final yet, distinct from undeliverable.
  failed: "warning",
  bounced: "warning",
  undeliverable: "destructive",
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
        toast.error("Can't send yet", { description: data.errors.join("\n") });
        return;
      }
      if (data.warnings.length) {
        const proceed = await confirmDialog(`${data.warnings.join("\n\n")}\n\nSend anyway?`);
        if (!proceed) return;
      }
    }
    await api.put(`/campaigns/${id}/status`, { status });
    await load();
    toast.success("Status updated");
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
          <p className="text-sm text-muted-foreground">Letters you've sent, scheduled, or are still drafting.</p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">New letter</Link>
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Send at</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <Fragment key={c.id}>
                <TableRow>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.subject}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{c.sendAt ? new Date(c.sendAt).toLocaleString() : "—"}</TableCell>
                  <TableCell>{c.sent}</TableCell>
                  <TableCell className="flex gap-2">
                    {(NEXT_STATUS[c.status] ?? []).map((s) => (
                      <Button key={s} variant="outline" size="sm" onClick={() => setStatus(c.id, s)}>
                        {s === "running" ? "Send now" : s}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => toggleLog(c.id)}>
                      {openLogId === c.id ? "Hide log" : "Delivery log"}
                    </Button>
                  </TableCell>
                </TableRow>
                {openLogId === c.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/40 p-0">
                      {stats && (
                        <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border px-4 py-3 text-sm">
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
                        <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
                      ) : log.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Email</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Error</TableHead>
                              <TableHead>When</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {log.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell>{entry.email}</TableCell>
                                <TableCell>
                                  <Badge variant={LOG_STATUS_VARIANT[entry.status]}>{entry.status}</Badge>
                                </TableCell>
                                <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={entry.error ?? ""}>
                                  {entry.error ?? "—"}
                                </TableCell>
                                <TableCell>{new Date(entry.sentAt).toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="px-4 py-3 text-sm text-muted-foreground">No sends recorded yet.</p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {!campaigns.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No letters yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
