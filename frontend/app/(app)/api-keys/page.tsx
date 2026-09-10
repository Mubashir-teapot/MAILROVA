"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { EmptyState, Loading } from "@/components/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <p className="text-sm text-muted-foreground">
        For programmatic access. Send <code>Authorization: Bearer &lt;key&gt;</code> instead of
        logging in. Each key has the same permissions as the user who created it.
      </p>

      {freshKey && (
        <Card className="flex flex-col gap-2 border-primary/40 bg-primary/5 p-5">
          <p className="text-sm font-semibold text-foreground">Copy this key now. It won&apos;t be shown again</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-foreground px-3 py-2 text-xs text-background">{freshKey}</code>
            <Button type="button" variant="outline" onClick={copyKey}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <button type="button" className="self-start text-xs text-muted-foreground hover:underline" onClick={() => setFreshKey(null)}>
            Done
          </button>
        </Card>
      )}

      <Card className="p-5">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="key-name">Name</Label>
            <Input id="key-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CI script" />
          </div>
          <Button type="submit">Create key</Button>
        </form>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <Loading />
      ) : keys.length === 0 ? (
        <Card className="p-5">
          <EmptyState message="No API keys yet." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>{k.name}</TableCell>
                  <TableCell>
                    <code className="text-xs">mrv_{k.keyPrefix}…</code>
                  </TableCell>
                  <TableCell>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</TableCell>
                  <TableCell>{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {k.revokedAt ? <Badge variant="destructive">Revoked</Badge> : <Badge variant="success">Active</Badge>}
                  </TableCell>
                  <TableCell className="w-10">
                    {!k.revokedAt && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRevoke(k.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Revoke"
                      >
                        <TrashIcon />
                      </Button>
                    )}
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
