"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { MediaIcon, UploadIcon } from "@/components/icons";
import { VisualEditor } from "./VisualEditor";
import { compileDoc, emptyDoc, TemplateDoc } from "./blocks";

interface MediaItem {
  id: number;
  filename: string;
  url: string;
}

type TemplateType = "campaign" | "campaign_visual" | "tx";

const STARTER_BODY = `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
  <h1>Hi {{Subscriber.FirstName}},</h1>
  <p>Write your message here.</p>
</div>`;

export function TemplateEditorView({ id }: { id?: string }) {
  const isNew = !id;
  const router = useRouter();

  const [name, setName] = useState("");
  const [type, setType] = useState<TemplateType>("campaign_visual");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(STARTER_BODY);
  const [doc, setDoc] = useState<TemplateDoc>(emptyDoc());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isNew) {
      api.get(`/templates/${id}`).then(({ data }) => {
        setName(data.name);
        setType(data.type as TemplateType);
        setSubject(data.subject ?? "");
        setBody(data.body);
        if (data.type === "campaign_visual" && data.bodySource) setDoc(data.bodySource as TemplateDoc);
      });
    }
  }, [id, isNew]);

  function loadMedia() {
    api.get("/media").then(({ data }) => setMedia(data));
  }

  function insertAtCursor(snippet: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => b + snippet);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    });
  }

  function insertImage(url: string) {
    insertAtCursor(`<img src="${url}" alt="" style="max-width:100%" />`);
    setPickerOpen(false);
  }

  async function handleUploadAndInsert(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post("/media", form, { headers: { "Content-Type": "multipart/form-data" } });
    insertImage(data.url);
    loadMedia();
    e.target.value = "";
  }

  async function handleSave() {
    setError(null);
    if (type === "tx" && !subject.trim()) {
      setError("Transactional templates need a subject.");
      return;
    }
    setSaving(true);
    try {
      const payload =
        type === "campaign_visual"
          ? { name, type, subject: subject || undefined, body: compileDoc(doc), bodySource: doc }
          : { name, type, subject: subject || undefined, body };

      if (isNew) {
        await api.post("/templates", payload);
      } else {
        await api.put(`/templates/${id}`, payload);
      }
      router.push("/templates");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="page-title">{isNew ? "New template" : "Edit template"}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Design it visually, or write raw HTML — drop in images either way.</p>
      </div>

      <div className="card grid grid-cols-3 gap-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="label">
          Name
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="label">
          Type
          <select className="input" value={type} onChange={(e) => setType(e.target.value as TemplateType)}>
            <option value="campaign_visual">Visual builder</option>
            <option value="campaign">HTML (campaign)</option>
            <option value="tx">Transactional</option>
          </select>
        </label>
        {type === "tx" && (
          <label className="label">
            Subject
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
        )}
      </div>

      {type === "campaign_visual" ? (
        <VisualEditor doc={doc} onChange={setDoc} />
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <div className="card flex flex-col gap-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">HTML</h3>
              <div className="relative">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setPickerOpen((v) => !v);
                    if (!pickerOpen) loadMedia();
                  }}
                >
                  <MediaIcon width={14} height={14} />
                  Insert image
                </button>
                {pickerOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <label className="btn w-full cursor-pointer justify-center text-xs">
                      <UploadIcon width={14} height={14} />
                      Upload new image
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadAndInsert} />
                    </label>
                    <div className="mt-3 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">
                      {media.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => insertImage(m.url)}
                          className="flex aspect-square items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:border-accent hover:text-accent dark:border-slate-700"
                          title={m.filename}
                        >
                          <MediaIcon width={20} height={20} />
                        </button>
                      ))}
                      {!media.length && <p className="col-span-3 text-xs text-slate-400">No uploaded media yet.</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              className="input min-h-[420px] font-mono text-xs leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="card flex flex-col gap-3 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Preview</h3>
            <iframe title="Template preview" srcDoc={body} sandbox="" className="min-h-[420px] w-full rounded-md border border-slate-200 bg-white" />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button className="btn" onClick={handleSave} disabled={saving || !name}>
          {saving ? "Saving…" : "Save template"}
        </button>
        <button className="btn-ghost" onClick={() => router.push("/templates")}>
          Cancel
        </button>
      </div>
    </div>
  );
}
