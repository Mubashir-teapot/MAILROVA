"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";

interface Template {
  id: number;
  name: string;
  type: string;
  isDefault: boolean;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);

  async function load() {
    const { data } = await api.get("/templates");
    setTemplates(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("Delete this template?")) return;
    await api.delete(`/templates/${id}`);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Templates</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Reusable designs — with images — for letters and transactional mail.</p>
        </div>
        <Link href="/templates/new" className="btn">
          New template
        </Link>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Default</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/templates/${t.id}`} className="font-medium text-accent hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td>{t.type}</td>
                <td>{t.isDefault ? <span className="badge bg-blue-100 text-accent dark:bg-blue-500/15 dark:text-blue-400">default</span> : ""}</td>
                <td className="w-10">
                  <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-600" aria-label="Delete">
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
            {!templates.length && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  No templates yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
