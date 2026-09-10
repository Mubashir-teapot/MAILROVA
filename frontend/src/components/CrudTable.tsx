"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { TrashIcon } from "./icons";
import { confirmDialog } from "./ConfirmDialog";
import { EmptyState, Loading } from "./States";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Column {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
}

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "select";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  // Coerces the select's (string) value to a Number before it lands in
  // form state — needed for fields like a numeric roleId the backend
  // validates strictly as z.number(), not a coercible string.
  numeric?: boolean;
  // Skip pre-filling this field when opening the edit dialog (and don't
  // treat it as required there) — for a password field where blank on
  // edit means "leave unchanged", not "clear it".
  editOptional?: boolean;
}

interface Props {
  resourcePath: string; // e.g. "/lists"
  columns: Column[];
  formFields: FormField[];
  extractList?: (data: any) => any[];
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: any;
  onChange: (value: any) => void;
}) {
  if (field.type === "checkbox") {
    return <Checkbox id={field.name} className="self-start" checked={!!value} onCheckedChange={(checked) => onChange(!!checked)} />;
  }
  if (field.type === "select") {
    return (
      <Select value={value !== undefined && value !== null ? String(value) : ""} onValueChange={(v) => onChange(field.numeric ? Number(v) : v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder={field.placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      id={field.name}
      type={field.type ?? "text"}
      required={field.required}
      value={value ?? ""}
      onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)}
    />
  );
}

export function CrudTable({ resourcePath, columns, formFields, extractList }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(resourcePath);
      setRows(extractList ? extractList(data) : data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourcePath]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(resourcePath, form);
      setForm({});
      await load();
      toast.success("Created");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to create");
    }
  }

  function openEdit(row: any) {
    const initial: Record<string, any> = {};
    for (const f of formFields) {
      if (!f.editOptional) initial[f.name] = row[f.name];
    }
    setEditForm(initial);
    setEditError(null);
    setEditingRow(row);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);
    setSaving(true);
    try {
      await api.put(`${resourcePath}/${editingRow.id}`, editForm);
      setEditingRow(null);
      await load();
      toast.success("Saved");
    } catch (err: any) {
      setEditError(err.response?.data?.error ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Delete this item?"))) return;
    try {
      await api.delete(`${resourcePath}/${id}`);
      await load();
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Failed to delete");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            {formFields.map((f) => (
              <div key={f.name} className="flex flex-col gap-1.5">
                <Label htmlFor={f.name}>{f.label}</Label>
                <FieldInput field={f} value={form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} />
              </div>
            ))}
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading ? (
        <Loading />
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key}>{c.label}</TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? "")}</TableCell>
                  ))}
                  <TableCell className="w-24 whitespace-nowrap">
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(row.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete"
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={columns.length + 1}>
                    <EmptyState message="Nothing here yet." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editingRow !== null} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            {formFields.map((f) => (
              <div key={f.name} className="flex flex-col gap-1.5">
                <Label htmlFor={f.name}>{f.editOptional ? `${f.label} (leave blank to keep unchanged)` : f.label}</Label>
                <FieldInput field={{ ...f, required: f.editOptional ? false : f.required }} value={editForm[f.name]} onChange={(v) => setEditForm({ ...editForm, [f.name]: v })} />
              </div>
            ))}
            {editError && <p className="text-sm text-destructive">{editError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingRow(null)}>
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
