"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
        <p className="text-sm text-muted-foreground">
          Add a domain to send from. We generate the DKIM key and give you every record to paste into Cloudflare.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain-name">Domain</Label>
            <Input
              id="domain-name"
              placeholder="marketing.yourdomain.com"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <Button type="submit">Add domain</Button>
        </form>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-3">
        {domains.map((d) => (
          <Card key={d.id} className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{d.domain}</p>
                <p className="text-xs text-muted-foreground">
                  Warmup: {d.sentToday} / {d.todaysCap} sent today (cap ramps up daily, max {d.maxDailyCap}/day)
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => (openId === d.id ? setOpenId(null) : openRecords(d.id))}>
                  {openId === d.id ? "Hide records" : "DNS records"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(d.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>

            {openId === d.id && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  {!records ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : (
                    <>
                      {!records.ready && (
                        <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                          DKIM key is still generating (mail server is restarting) — refresh in a few seconds.
                          <Button variant="outline" size="sm" onClick={() => refreshRecords(d.id)}>
                            Refresh
                          </Button>
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.records.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell>{r.type}</TableCell>
                              <TableCell className="font-mono text-xs">{r.name}</TableCell>
                              <TableCell className="max-w-md truncate font-mono text-xs" title={r.value}>
                                {r.value}
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" onClick={() => copy(r.value)}>
                                  Copy
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="text-xs text-muted-foreground">
                        One more thing DNS can't do: set reverse DNS (PTR) for your server's IP to match this domain/hostname —
                        that's done in your hosting provider's panel (Hostinger), not Cloudflare.
                      </p>
                    </>
                  )}
                </div>
              </>
            )}
          </Card>
        ))}
        {!domains.length && <p className="text-sm text-muted-foreground">No domains yet.</p>}
      </div>
    </div>
  );
}
