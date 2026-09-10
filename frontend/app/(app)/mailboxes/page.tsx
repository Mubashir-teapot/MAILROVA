"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

  const [passwordFor, setPasswordFor] = useState<number | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [capFor, setCapFor] = useState<{ id: number; current: number } | null>(null);
  const [capValue, setCapValue] = useState("");

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
      toast.success("Mailbox created");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to create mailbox");
    }
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Delete this mailbox?"))) return;
    await api.delete(`/mailboxes/${id}`);
    await load();
    toast.success("Mailbox deleted");
  }

  async function toggleEnabled(mailbox: Mailbox) {
    await api.put(`/mailboxes/${mailbox.id}/enabled`, { enabled: !mailbox.enabled });
    await load();
  }

  function openPasswordDialog(id: number) {
    setPasswordValue("");
    setPasswordFor(id);
  }

  async function submitPassword() {
    if (passwordValue.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    await api.put(`/mailboxes/${passwordFor}/password`, { password: passwordValue });
    setPasswordFor(null);
    toast.success("Password updated");
  }

  function openCapDialog(id: number, current: number) {
    setCapValue(String(current));
    setCapFor({ id, current });
  }

  async function submitCap() {
    if (!capFor) return;
    await api.put(`/mailboxes/${capFor.id}/daily-cap`, { dailyCap: Number(capValue) });
    setCapFor(null);
    await load();
    toast.success("Daily limit updated");
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
        <p className="text-sm text-muted-foreground">
          Sending accounts on your verified domains (e.g. info@ or sales@), with their own password, daily limit, and
          user access.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Domain</Label>
            <Select value={form.domainId} onValueChange={(v) => setForm({ ...form, domainId: v })}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select a domain…" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mb-email">Email</Label>
            <Input
              id="mb-email"
              placeholder="info@marketing.yourdomain.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mb-name">Display name</Label>
            <Input id="mb-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mb-password">Password (optional, for SMTP-AUTH)</Label>
            <Input
              id="mb-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="flex w-28 flex-col gap-1.5">
            <Label htmlFor="mb-cap">Daily limit</Label>
            <Input
              id="mb-cap"
              type="number"
              value={form.dailyCap}
              onChange={(e) => setForm({ ...form, dailyCap: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={!domains.length}>
            Add mailbox
          </Button>
          {!domains.length && <p className="text-xs text-muted-foreground">Add a domain first.</p>}
        </form>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col gap-3">
        {mailboxes.map((mailbox) => (
          <Card key={mailbox.id} className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="flex items-center gap-2 font-medium text-foreground">
                  {mailbox.name} <span className="text-muted-foreground">&lt;{mailbox.email}&gt;</span>
                  <Badge variant={mailbox.enabled ? "success" : "secondary"}>
                    {mailbox.enabled ? "enabled" : "disabled"}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {mailbox.domain.domain} · {mailbox.dailyCap} emails/day
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openCapDialog(mailbox.id, mailbox.dailyCap)}>
                  Set limit
                </Button>
                <Button variant="outline" size="sm" onClick={() => openPasswordDialog(mailbox.id)}>
                  Set password
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleEnabled(mailbox)}>
                  {mailbox.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(mailbox.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <TrashIcon />
                </Button>
              </div>
            </div>
            <div>
              <Label className="mb-2 inline-block">Assigned users</Label>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => {
                  const assigned = mailbox.users.some((iu) => iu.user.id === u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(mailbox, u.id)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs",
                        assigned
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/20"
                      )}
                    >
                      {u.username}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
        {!mailboxes.length && <p className="text-sm text-muted-foreground">No mailboxes yet.</p>}
      </div>

      <Dialog open={passwordFor !== null} onOpenChange={(open) => !open && setPasswordFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set mailbox password</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password (min 8 characters)</Label>
            <Input
              id="new-password"
              type="password"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitPassword}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={capFor !== null} onOpenChange={(open) => !open && setCapFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set daily send limit</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-cap">Emails per day</Label>
            <Input id="new-cap" type="number" value={capValue} onChange={(e) => setCapValue(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapFor(null)}>
              Cancel
            </Button>
            <Button onClick={submitCap}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
