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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface Column {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
}

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "number" | "checkbox";
  required?: boolean;
}

interface Props {
  resourcePath: string; // e.g. "/lists"
  columns: Column[];
  formFields: FormField[];
  extractList?: (data: any) => any[];
}

export function CrudTable({ resourcePath, columns, formFields, extractList }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                {f.type === "checkbox" ? (
                  <Checkbox
                    id={f.name}
                    className="self-start"
                    checked={!!form[f.name]}
                    onCheckedChange={(checked) => setForm({ ...form, [f.name]: !!checked })}
                  />
                ) : (
                  <Input
                    id={f.name}
                    type={f.type ?? "text"}
                    required={f.required}
                    value={form[f.name] ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value,
                      })
                    }
                  />
                )}
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
                  <TableCell className="w-10">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(row.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                    >
                      <TrashIcon />
                    </Button>
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
    </div>
  );
}
