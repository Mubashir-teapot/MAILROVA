"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { UploadIcon } from "@/components/icons";

interface ListOption {
  id: number;
  name: string;
}

interface TemplateOption {
  id: number;
  name: string;
}

interface ImportResult {
  total: number;
  imported: number;
  emailed: number;
  errors: string[];
}

export default function Import() {
  const [lists, setLists] = useState<ListOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"subscribe" | "blocklist">("subscribe");
  const [listIds, setListIds] = useState<Set<number>>(new Set());
  const [templateId, setTemplateId] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/lists").then(({ data }) => setLists(data));
    api.get("/templates").then(({ data }) => setTemplates(data.filter((t: any) => t.type !== "campaign_visual")));
  }, []);

  function toggleList(id: number) {
    setListIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const params = {
        mode,
        listIds: Array.from(listIds),
        templateId: templateId ? Number(templateId) : undefined,
      };
      const body = new FormData();
      body.append("params", JSON.stringify(params));
      body.append("file", file);

      const { data } = await api.post("/import/subscribers", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="page-title">Import subscribers</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload a CSV with an <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">email</code> column
          (optional <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">name</code> and{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">attributes</code> as JSON).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-4">
        <label className="btn w-fit cursor-pointer">
          <UploadIcon width={16} height={16} />
          {file ? file.name : "Choose CSV file"}
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="label max-w-xs">
          Mode
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="subscribe">Subscribe to list(s)</option>
            <option value="blocklist">Blocklist these addresses</option>
          </select>
        </label>

        {mode === "subscribe" && (
          <>
            <div>
              <span className="label mb-2">Add to list(s)</span>
              <div className="flex flex-wrap gap-2">
                {lists.map((l) => (
                  <label
                    key={l.id}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
                      listIds.has(l.id)
                        ? "border-accent bg-blue-50 text-accent dark:bg-blue-500/10"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
                    }`}
                  >
                    <input type="checkbox" className="hidden" checked={listIds.has(l.id)} onChange={() => toggleList(l.id)} />
                    {l.name}
                  </label>
                ))}
              </div>
            </div>

            <label className="label max-w-sm">
              Send a template to every imported subscriber (optional)
              <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">— don't send anything —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn w-fit" disabled={!file || loading}>
          {loading ? "Importing…" : "Import"}
        </button>
      </form>

      {result && (
        <div className="card flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Result</h3>
          <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-300">
            <span>
              <strong className="text-slate-900 dark:text-slate-100">{result.total}</strong> rows
            </span>
            <span>
              <strong className="text-slate-900 dark:text-slate-100">{result.imported}</strong> imported
            </span>
            <span>
              <strong className="text-slate-900 dark:text-slate-100">{result.emailed}</strong> emailed
            </span>
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-red-600">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
