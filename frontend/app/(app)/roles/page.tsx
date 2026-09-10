"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, Loading } from "@/components/States";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Role {
  id: number;
  name: string;
  type: string;
  permissions: string[];
}

// One toggle per sidebar tab, each granting everything that tab needs to
// fully work (view + create/edit/delete), not just enough to see it — this
// trades away fine-grained per-action control (can't grant view-only) for a
// picker that matches how the sidebar itself is actually organized. Bounces
// and Suppressions share one toggle (and Domains and Settings share
// another) because they're already gated by the exact same backend
// permissions (see bounces.routes.ts/suppressions.routes.ts and
// domains.routes.ts/settings.routes.ts) — showing them as independently
// controllable would be a UI lie, toggling one would silently move the
// other too. Dashboard isn't listed (always visible to any logged-in
// user), and Users/Roles aren't listed (Super Admin only, not something
// any permission here can grant — see requireSuperAdmin).
const TABS: { label: string; permissions: string[] }[] = [
  { label: "Subscribers", permissions: ["subscribers:get_all", "subscribers:manage"] },
  { label: "Import", permissions: ["subscribers:import"] },
  { label: "Lists", permissions: ["lists:get_all", "lists:manage_all"] },
  { label: "Campaigns", permissions: ["campaigns:get_all", "campaigns:manage_all", "campaigns:send", "campaigns:get_analytics"] },
  { label: "Templates", permissions: ["templates:get", "templates:manage"] },
  { label: "Media", permissions: ["media:get", "media:manage"] },
  { label: "Bounces & Suppressions", permissions: ["bounces:get", "bounces:manage"] },
  { label: "Domains & Settings", permissions: ["settings:get", "settings:manage"] },
  { label: "Mailboxes", permissions: ["users:get", "users:manage"] },
  { label: "Audit Log", permissions: ["audit:get"] },
];

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/roles");
      setRoles(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setName("");
    setPermissions(new Set());
    setError(null);
    setEditing("new");
  }

  function openEdit(role: Role) {
    setName(role.name);
    setPermissions(new Set(role.permissions));
    setError(null);
    setEditing(role);
  }

  function toggleTab(tabPermissions: string[], allChecked: boolean) {
    setPermissions((prev) => {
      const next = new Set(prev);
      for (const perm of tabPermissions) {
        allChecked ? next.delete(perm) : next.add(perm);
      }
      return next;
    });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = { name, permissions: Array.from(permissions) };
      if (editing === "new") {
        await api.post("/roles", payload);
        toast.success("Role created");
      } else if (editing) {
        await api.put(`/roles/${editing.id}`, payload);
        toast.success("Role updated");
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to save role");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role: Role) {
    if (!(await confirmDialog(`Delete the "${role.name}" role?`))) return;
    try {
      await api.delete(`/roles/${role.id}`);
      await load();
      toast.success("Role deleted");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to delete role");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Roles</h2>
          <p className="text-sm text-muted-foreground">
            What a user can see and do. Assign tabs here, then pick a role for each user on the Users page.
            The sidebar itself follows these: a tab only shows up for a user whose role has it checked below.
          </p>
        </div>
        <Button onClick={openCreate}>New role</Button>
      </div>

      {loading ? (
        <Loading />
      ) : roles.length === 0 ? (
        <Card className="p-5">
          <EmptyState message="No roles yet." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tabs</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => {
                const roleSet = new Set(role.permissions);
                const grantedTabs = TABS.filter((t) => t.permissions.every((p) => roleSet.has(p)));
                return (
                  <TableRow key={role.id}>
                    <TableCell className="whitespace-nowrap align-top font-medium text-foreground">{role.name}</TableCell>
                    <TableCell className="whitespace-nowrap align-top">{role.type}</TableCell>
                    <TableCell>
                      {role.name === "Super Admin" ? (
                        <Badge>All tabs</Badge>
                      ) : grantedTabs.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {grantedTabs.map((t) => (
                            <Badge key={t.label} variant="secondary">
                              {t.label}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No tabs</span>
                      )}
                    </TableCell>
                    <TableCell className="w-20 whitespace-nowrap align-top">
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                          Edit
                        </Button>
                        {role.name !== "Super Admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(role)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Delete"
                          >
                            <TrashIcon />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New role" : `Edit "${(editing as Role)?.name}"`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>

            <div>
              <Label className="mb-2 inline-block">Tabs this role can see and use</Label>
              <div className="flex max-h-[360px] flex-col gap-1 overflow-y-auto rounded-md border border-border p-3">
                {TABS.map((tab) => {
                  const allChecked = tab.permissions.every((p) => permissions.has(p));
                  return (
                    <label
                      key={tab.label}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted/50"
                    >
                      <Checkbox checked={allChecked} onCheckedChange={() => toggleTab(tab.permissions, allChecked)} />
                      {tab.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
