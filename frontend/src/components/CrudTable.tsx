"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { TrashIcon } from "./icons";
import { confirmDialog } from "./ConfirmDialog";
import { EmptyState, Loading } from "./States";

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
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to create");
    }
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Delete this item?"))) return;
    await api.delete(`${resourcePath}/${id}`);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="card flex flex-wrap items-end gap-3">
        {formFields.map((f) => (
          <label key={f.name} className="label">
            {f.label}
            {f.type === "checkbox" ? (
              <input
                type="checkbox"
                className="h-4 w-4 self-start accent-accent"
                checked={!!form[f.name]}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
              />
            ) : (
              <input
                type={f.type ?? "text"}
                required={f.required}
                className="input"
                value={form[f.name] ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value,
                  })
                }
              />
            )}
          </label>
        ))}
        <button type="submit" className="btn">
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table-base">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? "")}</td>
                  ))}
                  <td className="w-10">
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={columns.length + 1}>
                    <EmptyState message="Nothing here yet." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
