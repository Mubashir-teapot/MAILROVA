"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

// Groups "campaigns:manage_all" -> group "campaigns", action "manage_all" —
// purely a display/organization aid, the actual permission string sent to
// the backend is always the full "resource:action" key.
function groupPermissions(catalog: string[]) {
  const groups = new Map<string, string[]>();
  for (const perm of catalog) {
    const [resource, action] = perm.split(":");
    if (!groups.has(resource)) groups.set(resource, []);
    groups.get(resource)!.push(action);
  }
  return Array.from(groups.entries());
}

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => groupPermissions(catalog), [catalog]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/roles");
      setRoles(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get("/roles/permissions").then(({ data }) => setCatalog(data));
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

  function togglePermission(perm: string) {
    setPermissions((prev) => {
      const next = new Set(prev);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
  }

  function toggleGroup(group: string, actions: string[], allChecked: boolean) {
    setPermissions((prev) => {
      const next = new Set(prev);
      for (const action of actions) {
        const perm = `${group}:${action}`;
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
            What a user can see and do. Assign permissions here, then pick a role for each user on the Users page.
            The sidebar itself follows these: a page only shows up for a user whose role has permission for it.
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
                <TableHead>Permissions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="whitespace-nowrap align-top font-medium text-foreground">{role.name}</TableCell>
                  <TableCell className="whitespace-nowrap align-top">{role.type}</TableCell>
                  <TableCell>
                    {role.permissions.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {role.permissions.map((p) => (
                          <Badge key={p} variant="secondary">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No permissions</span>
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
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "New role" : `Edit "${(editing as Role)?.name}"`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>

            <div>
              <Label className="mb-2 inline-block">Permissions (what this role can see and do)</Label>
              <div className="grid max-h-[360px] grid-cols-2 gap-3 overflow-y-auto rounded-md border border-border p-3">
                {groups.map(([group, actions]) => {
                  const allChecked = actions.every((a) => permissions.has(`${group}:${a}`));
                  return (
                    <div key={group} className="flex flex-col gap-1.5 rounded-md border border-border p-2.5">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold capitalize text-foreground">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={() => toggleGroup(group, actions, allChecked)}
                        />
                        {group.replace(/_/g, " ")}
                      </label>
                      <div className="flex flex-col gap-1 pl-6">
                        {actions.map((action) => {
                          const perm = `${group}:${action}`;
                          return (
                            <label key={perm} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                              <Checkbox checked={permissions.has(perm)} onCheckedChange={() => togglePermission(perm)} />
                              {action.replace(/_/g, " ")}
                            </label>
                          );
                        })}
                      </div>
                    </div>
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
