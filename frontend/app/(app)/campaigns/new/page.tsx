"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";

interface ListOption {
  id: number;
  name: string;
}

interface TemplateOption {
  id: number;
  name: string;
  subject: string | null;
  body: string;
}

interface IdentityOption {
  id: number;
  email: string;
  name: string;
}

export default function NewCampaign() {
  const router = useRouter();
  const [lists, setLists] = useState<ListOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [identities, setIdentities] = useState<IdentityOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    subject: "",
    fromEmail: "",
    templateId: "",
    contentType: "html" as "html" | "plain" | "markdown",
    body: "",
    listIds: new Set<number>(),
    toEmails: "",
    cc: "",
    bcc: "",
    sendAt: "",
  });

  useEffect(() => {
    api.get("/lists").then(({ data }) => setLists(data));
    api.get("/templates").then(({ data }) => setTemplates(data));
    api.get("/mailboxes/mine").then(({ data }) => {
      setIdentities(data);
      if (data.length === 1) setForm((f) => ({ ...f, fromEmail: data[0].email }));
    });
  }, []);

  function toggleList(id: number) {
    setForm((f) => {
      const next = new Set(f.listIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...f, listIds: next };
    });
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => String(t.id) === templateId);
    setForm((f) => ({
      ...f,
      templateId,
      body: tpl?.body ?? f.body,
      subject: f.subject || tpl?.subject || "",
    }));
  }

  function splitEmails(value: string) {
    return value
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const listIds = Array.from(form.listIds);
    const toEmails = splitEmails(form.toEmails);
    if (!listIds.length && !toEmails.length) {
      setError("Choose at least one list, or add a recipient e-mail.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/campaigns", {
        name: form.name,
        subject: form.subject,
        fromEmail: form.fromEmail,
        templateId: form.templateId ? Number(form.templateId) : undefined,
        contentType: form.contentType,
        body: form.body,
        listIds,
        toEmails,
        cc: splitEmails(form.cc),
        bcc: splitEmails(form.bcc),
        sendAt: form.sendAt ? new Date(form.sendAt).toISOString() : undefined,
      });
      router.push("/campaigns");
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to create letter");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="page-title">New letter</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Pick a template, choose who receives it, and send.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="card grid grid-cols-2 gap-4">
          <label className="label">
            Internal name
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="label">
            From
            {identities.length ? (
              <select
                className="input"
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                required
              >
                <option value="">Select a sender identity…</option>
                {identities.map((i) => (
                  <option key={i.id} value={i.email}>
                    {i.name} &lt;{i.email}&gt;
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="email"
                className="input"
                placeholder="you@yourdomain.com"
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                required
              />
            )}
          </label>
          <label className="label col-span-2">
            Subject
            <input
              className="input"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
            />
          </label>
        </div>

        <div className="card flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recipients</h3>

          <div>
            <span className="label mb-2">Lists (send to everyone subscribed)</span>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <label
                  key={l.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
                    form.listIds.has(l.id)
                      ? "border-accent bg-blue-50 text-accent dark:bg-blue-500/10"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.listIds.has(l.id)}
                    onChange={() => toggleList(l.id)}
                  />
                  {l.name}
                </label>
              ))}
              {!lists.length && <p className="text-xs text-slate-400">No lists yet.</p>}
            </div>
          </div>

          <label className="label">
            Or specific e-mail(s) — one person, or a handful, comma or newline separated
            <textarea
              className="input"
              rows={2}
              placeholder="someone@example.com, another@example.com"
              value={form.toEmails}
              onChange={(e) => setForm({ ...form, toEmails: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="label">
              CC
              <input
                className="input"
                placeholder="cc@example.com"
                value={form.cc}
                onChange={(e) => setForm({ ...form, cc: e.target.value })}
              />
            </label>
            <label className="label">
              BCC
              <input
                className="input"
                placeholder="bcc@example.com"
                value={form.bcc}
                onChange={(e) => setForm({ ...form, bcc: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="card flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Content</h3>
          <div className="grid grid-cols-2 gap-4">
            <label className="label">
              Template
              <select
                className="input"
                value={form.templateId}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">— none, write from scratch —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Format
              <select
                className="input"
                value={form.contentType}
                onChange={(e) => setForm({ ...form, contentType: e.target.value as typeof form.contentType })}
              >
                <option value="html">HTML</option>
                <option value="plain">Plain text</option>
                <option value="markdown">Markdown</option>
              </select>
            </label>
          </div>
          <label className="label">
            Body — use {"{{Subscriber.Email}}"}, {"{{Subscriber.Name}}"}, {"{{Subscriber.FirstName}}"}
            <textarea
              className="input font-mono"
              rows={12}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
            />
          </label>
        </div>

        <div className="card flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Delivery</h3>
          <label className="label max-w-xs">
            Send at (leave empty to send immediately)
            <input
              type="datetime-local"
              className="input"
              value={form.sendAt}
              onChange={(e) => setForm({ ...form, sendAt: e.target.value })}
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" className="btn" disabled={submitting}>
            {form.sendAt ? "Schedule letter" : "Save as draft"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => router.push("/campaigns")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
