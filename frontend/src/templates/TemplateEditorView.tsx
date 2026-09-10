"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/api/client";
import { MediaIcon, UploadIcon } from "@/components/icons";
import { VisualEditor } from "./VisualEditor";
import { compileDoc, emptyDoc, TemplateDoc } from "./blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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

  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

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
    api
      .get("/media")
      .then(({ data }) => setMedia(data))
      .catch((err) => toast.error(err.response?.data?.error ?? "Failed to load media library"));
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

  async function handleSendTest() {
    if (!id || !testEmail.trim()) return;
    setTestStatus("sending");
    try {
      await api.post(`/templates/${id}/test-send`, { email: testEmail.trim() });
      setTestStatus("sent");
    } catch {
      setTestStatus("error");
    }
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
        <p className="text-sm text-muted-foreground">Design it visually, or write raw HTML. Drop in images either way.</p>
      </div>

      <Card className="grid grid-cols-3 gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tpl-name">Name</Label>
          <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as TemplateType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="campaign_visual">Visual builder</SelectItem>
              <SelectItem value="campaign">HTML (campaign)</SelectItem>
              <SelectItem value="tx">Transactional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type === "tx" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tpl-subject">Subject</Label>
            <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        )}
      </Card>

      {type === "campaign_visual" ? (
        <VisualEditor doc={doc} onChange={setDoc} />
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">HTML</h3>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPickerOpen((v) => !v);
                    if (!pickerOpen) loadMedia();
                  }}
                >
                  <MediaIcon width={14} height={14} />
                  Insert image
                </Button>
                {pickerOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
                    <Button variant="outline" className="w-full cursor-pointer justify-center text-xs" asChild>
                      <label>
                        <UploadIcon width={14} height={14} />
                        Upload new image
                        <input type="file" accept="image/*" className="hidden" onChange={handleUploadAndInsert} />
                      </label>
                    </Button>
                    <div className="mt-3 grid max-h-56 grid-cols-3 gap-2 overflow-y-auto">
                      {media.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => insertImage(m.url)}
                          className="flex aspect-square items-center justify-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-primary"
                          title={m.filename}
                        >
                          <MediaIcon width={20} height={20} />
                        </button>
                      ))}
                      {!media.length && <p className="col-span-3 text-xs text-muted-foreground">No uploaded media yet.</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Textarea
              ref={textareaRef}
              className="min-h-[420px] font-mono text-xs leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h3 className="text-sm font-semibold text-foreground">Preview</h3>
            <iframe title="Template preview" srcDoc={body} sandbox="" className="min-h-[420px] w-full rounded-md border border-border bg-white" />
          </Card>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving || !name}>
          {saving ? "Saving…" : "Save template"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/templates")}>
          Cancel
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {!isNew && (
            <>
              <Input
                type="email"
                className="w-56"
                placeholder="you@example.com"
                value={testEmail}
                onChange={(e) => {
                  setTestEmail(e.target.value);
                  setTestStatus("idle");
                }}
              />
              <Button type="button" variant="outline" onClick={handleSendTest} disabled={!testEmail.trim() || testStatus === "sending"}>
                {testStatus === "sending" ? "Sending…" : "Send test"}
              </Button>
              {testStatus === "sent" && <span className="text-xs text-emerald-600 dark:text-emerald-400">Sent</span>}
              {testStatus === "error" && <span className="text-xs text-destructive">Failed</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
