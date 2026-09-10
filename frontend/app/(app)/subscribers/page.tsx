"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { CloseIcon, TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ListOption {
  id: number;
  name: string;
}

interface SubscriberList {
  listId: number;
  status: string;
  list: ListOption;
}

interface Subscriber {
  id: number;
  email: string;
  name: string;
  status: string;
  lists: SubscriberList[];
}

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  enabled: "success",
  disabled: "secondary",
  blocklisted: "destructive",
};

export default function Subscribers() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [lists, setLists] = useState<ListOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ email: "", name: "", listIds: new Set<number>() });

  async function load() {
    const { data } = await api.get("/subscribers", { params: { search: search || undefined, perPage: 50 } });
    setSubscribers(data.results);
    setTotal(data.total);
  }

  useEffect(() => {
    api.get("/lists").then(({ data }) => setLists(data));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function toggleList(id: number) {
    setForm((f) => {
      const next = new Set(f.listIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...f, listIds: next };
    });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/subscribers", {
        email: form.email,
        name: form.name,
        listIds: Array.from(form.listIds),
      });
      setForm({ email: "", name: "", listIds: new Set() });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to add subscriber");
    }
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Delete this subscriber?"))) return;
    await api.delete(`/subscribers/${id}`);
    await load();
  }

  async function handleUnsubscribe(subscriberId: number, listId: number) {
    await api.post(`/subscribers/${subscriberId}/unsubscribe`, { listId });
    await load();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Subscribers</h2>
          <p className="text-sm text-muted-foreground">Everyone you can email, across every list — {total} total.</p>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="p-5">
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-email">Email</Label>
              <Input
                id="sub-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-name">Name</Label>
              <Input
                id="sub-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 inline-block">Lists</Label>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <label
                  key={l.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm",
                    form.listIds.has(l.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/20"
                  )}
                >
                  <input type="checkbox" className="hidden" checked={form.listIds.has(l.id)} onChange={() => toggleList(l.id)} />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-fit">
            Add subscriber
          </Button>
        </form>
      </Card>

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lists</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.email}</TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {s.lists.map((sl) => (
                      <span
                        key={sl.listId}
                        className="group flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {sl.list.name}
                        <span className="text-muted-foreground/70">({sl.status})</span>
                        <button
                          onClick={() => handleUnsubscribe(s.id, sl.listId)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Unsubscribe from this list"
                        >
                          <CloseIcon width={12} height={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="w-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(s.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <TrashIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!subscribers.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No subscribers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
