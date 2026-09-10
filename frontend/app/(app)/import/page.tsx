"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { UploadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  skipped: number;
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
        <p className="text-sm text-muted-foreground">
          Upload a CSV with an <code className="rounded bg-muted px-1 py-0.5 text-xs">email</code> column
          (optional <code className="rounded bg-muted px-1 py-0.5 text-xs">name</code> and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">attributes</code> as JSON).
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Button type="button" variant="outline" className="w-fit cursor-pointer" asChild>
            <label>
              <UploadIcon width={16} height={16} />
              {file ? file.name : "Choose CSV file"}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </Button>

          <div className="flex max-w-xs flex-col gap-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subscribe">Subscribe to list(s)</SelectItem>
                <SelectItem value="blocklist">Blocklist these addresses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "subscribe" && (
            <>
              <div>
                <Label className="mb-2 inline-block">Add to list(s)</Label>
                <div className="flex flex-wrap gap-2">
                  {lists.map((l) => (
                    <label
                      key={l.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm",
                        listIds.has(l.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/20"
                      )}
                    >
                      <input type="checkbox" className="hidden" checked={listIds.has(l.id)} onChange={() => toggleList(l.id)} />
                      {l.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex max-w-sm flex-col gap-1.5">
                <Label>Send a template to every imported subscriber (optional)</Label>
                <Select value={templateId || "__none"} onValueChange={(v) => setTemplateId(v === "__none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— don't send anything —</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-fit" disabled={!file || loading}>
            {loading ? "Importing…" : "Import"}
          </Button>
        </form>
      </Card>

      {result && (
        <Card className="flex flex-col gap-2 p-5">
          <h3 className="text-sm font-semibold text-foreground">Result</h3>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{result.total}</strong> rows
            </span>
            <span>
              <strong className="text-foreground">{result.imported}</strong> imported
            </span>
            <span>
              <strong className="text-foreground">{result.emailed}</strong> emailed
            </span>
            <span>
              <strong className="text-foreground">{result.skipped}</strong> skipped (suppressed)
            </span>
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-destructive">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
