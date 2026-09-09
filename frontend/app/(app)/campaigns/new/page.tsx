"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { CheckIcon } from "@/components/icons";

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

const STEPS = ["Audience", "Sender", "Content", "Tracking", "Schedule", "Review"] as const;
type Step = (typeof STEPS)[number];

function splitEmails(value: string) {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function NewCampaign() {
  const router = useRouter();
  const [lists, setLists] = useState<ListOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [identities, setIdentities] = useState<IdentityOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const step: Step = STEPS[stepIndex];

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
    trackOpens: true,
    trackClicks: true,
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

  const stepError: Partial<Record<Step, string>> = {
    Audience: form.listIds.size === 0 && !splitEmails(form.toEmails).length ? "Choose at least one list, or add a recipient e-mail." : undefined,
    Sender: !form.name.trim() ? "Give this letter an internal name." : !form.fromEmail.trim() ? "Choose or enter a sender address." : undefined,
    Content: !form.subject.trim() ? "Subject is required." : !form.body.trim() ? "Content is required." : undefined,
  };

  function goNext() {
    const blocking = stepError[step];
    if (blocking) {
      setError(blocking);
      return;
    }
    setError(null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/campaigns", {
        name: form.name,
        subject: form.subject,
        fromEmail: form.fromEmail,
        templateId: form.templateId ? Number(form.templateId) : undefined,
        contentType: form.contentType,
        body: form.body,
        listIds: Array.from(form.listIds),
        toEmails: splitEmails(form.toEmails),
        cc: splitEmails(form.cc),
        bcc: splitEmails(form.bcc),
        trackOpens: form.trackOpens,
        trackClicks: form.trackClicks,
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

      <StepIndicator steps={STEPS} current={stepIndex} onJump={(i) => i < stepIndex && setStepIndex(i)} />

      <div className="card flex flex-col gap-4">
        {step === "Audience" && (
          <>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Audience</h3>
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
                    <input type="checkbox" className="hidden" checked={form.listIds.has(l.id)} onChange={() => toggleList(l.id)} />
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
                <input className="input" placeholder="cc@example.com" value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} />
              </label>
              <label className="label">
                BCC
                <input className="input" placeholder="bcc@example.com" value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} />
              </label>
            </div>
          </>
        )}

        {step === "Sender" && (
          <>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sender</h3>
            <label className="label">
              Internal name — for your own reference, recipients never see it
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="label">
              From
              {identities.length ? (
                <select className="input" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} required>
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
          </>
        )}

        {step === "Content" && (
          <>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Content</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="label">
                Template
                <select className="input" value={form.templateId} onChange={(e) => applyTemplate(e.target.value)}>
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
              Subject
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            </label>
            <label className="label">
              Body — use {"{{Subscriber.Email}}"}, {"{{Subscriber.Name}}"}, {"{{Subscriber.FirstName}}"}
              <textarea className="input font-mono" rows={12} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            </label>
          </>
        )}

        {step === "Tracking" && (
          <>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tracking</h3>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={form.trackOpens}
                onChange={(e) => setForm({ ...form, trackOpens: e.target.checked })}
              />
              Track opens
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={form.trackClicks}
                onChange={(e) => setForm({ ...form, trackClicks: e.target.checked })}
              />
              Track link clicks
            </label>
            <p className="text-xs text-slate-400">
              Opens are tracked via an invisible pixel; clicks via a redirect link — both are per-recipient, so turning
              either off applies to this whole letter.
            </p>
          </>
        )}

        {step === "Schedule" && (
          <>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Schedule</h3>
            <label className="label max-w-xs">
              Send at (leave empty to send immediately after creating)
              <input type="datetime-local" className="input" value={form.sendAt} onChange={(e) => setForm({ ...form, sendAt: e.target.value })} />
            </label>
          </>
        )}

        {step === "Review" && (
          <>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Review</h3>
            <dl className="grid grid-cols-[140px,1fr] gap-y-2 text-sm">
              <dt className="text-slate-400">Name</dt>
              <dd>{form.name || "—"}</dd>
              <dt className="text-slate-400">From</dt>
              <dd>{form.fromEmail || "—"}</dd>
              <dt className="text-slate-400">Subject</dt>
              <dd>{form.subject || "—"}</dd>
              <dt className="text-slate-400">Lists</dt>
              <dd>{form.listIds.size ? lists.filter((l) => form.listIds.has(l.id)).map((l) => l.name).join(", ") : "—"}</dd>
              <dt className="text-slate-400">Ad-hoc recipients</dt>
              <dd>{splitEmails(form.toEmails).length || 0}</dd>
              <dt className="text-slate-400">Tracking</dt>
              <dd>
                {form.trackOpens ? "Opens" : null}
                {form.trackOpens && form.trackClicks ? " + " : null}
                {form.trackClicks ? "Clicks" : null}
                {!form.trackOpens && !form.trackClicks ? "Off" : null}
              </dd>
              <dt className="text-slate-400">Schedule</dt>
              <dd>{form.sendAt ? new Date(form.sendAt).toLocaleString() : "Send immediately after creating"}</dd>
            </dl>
            <p className="text-xs text-slate-400">
              A pre-flight check (sender DNS, mailbox status, recipient count, unresolved variables) runs automatically
              when you hit Send from the campaigns list — this just creates the letter.
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex items-center gap-3">
          {stepIndex > 0 && (
            <button type="button" className="btn-ghost" onClick={goBack}>
              Back
            </button>
          )}
          {step !== "Review" ? (
            <button type="button" className="btn" onClick={goNext}>
              Next
            </button>
          ) : (
            <button type="button" className="btn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : form.sendAt ? "Schedule letter" : "Create letter"}
            </button>
          )}
          <button type="button" className="btn-ghost ml-auto" onClick={() => router.push("/campaigns")}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ steps, current, onJump }: { steps: readonly string[]; current: number; onJump: (index: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onJump(i)}
            disabled={i > current}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              i === current
                ? "bg-accent text-white"
                : i < current
                ? "bg-blue-50 text-accent hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20"
                : "bg-slate-100 text-slate-400 dark:bg-white/5"
            }`}
          >
            {i < current ? <CheckIcon width={12} height={12} /> : <span>{i + 1}</span>}
            {label}
          </button>
          {i < steps.length - 1 && <div className={`h-px flex-1 ${i < current ? "bg-accent/40" : "bg-slate-200 dark:bg-white/10"}`} />}
        </div>
      ))}
    </div>
  );
}
