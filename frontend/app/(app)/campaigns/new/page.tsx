"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
        <p className="text-sm text-muted-foreground">Pick a template, choose who receives it, and send.</p>
      </div>

      <StepIndicator steps={STEPS} current={stepIndex} onJump={(i) => i < stepIndex && setStepIndex(i)} />

      <Card className="flex flex-col gap-4 p-5">
        {step === "Audience" && (
          <>
            <h3 className="text-sm font-semibold text-foreground">Audience</h3>
            <div>
              <Label className="mb-2 inline-block">Lists (send to everyone subscribed)</Label>
              <div className="flex flex-wrap gap-2">
                {lists.map((l) => (
                  <label
                    key={l.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm",
                      form.listIds.has(l.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    )}
                  >
                    <input type="checkbox" className="hidden" checked={form.listIds.has(l.id)} onChange={() => toggleList(l.id)} />
                    {l.name}
                  </label>
                ))}
                {!lists.length && <p className="text-xs text-muted-foreground">No lists yet.</p>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to-emails">Or specific e-mail(s) — one person, or a handful, comma or newline separated</Label>
              <Textarea
                id="to-emails"
                rows={2}
                placeholder="someone@example.com, another@example.com"
                value={form.toEmails}
                onChange={(e) => setForm({ ...form, toEmails: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cc">CC</Label>
                <Input id="cc" placeholder="cc@example.com" value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bcc">BCC</Label>
                <Input id="bcc" placeholder="bcc@example.com" value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} />
              </div>
            </div>
          </>
        )}

        {step === "Sender" && (
          <>
            <h3 className="text-sm font-semibold text-foreground">Sender</h3>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="camp-name">Internal name — for your own reference, recipients never see it</Label>
              <Input id="camp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>From</Label>
              {identities.length ? (
                <Select value={form.fromEmail} onValueChange={(v) => setForm({ ...form, fromEmail: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sender identity…" />
                  </SelectTrigger>
                  <SelectContent>
                    {identities.map((i) => (
                      <SelectItem key={i.id} value={i.email}>
                        {i.name} &lt;{i.email}&gt;
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="email"
                  placeholder="you@yourdomain.com"
                  value={form.fromEmail}
                  onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                  required
                />
              )}
            </div>
          </>
        )}

        {step === "Content" && (
          <>
            <h3 className="text-sm font-semibold text-foreground">Content</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Template</Label>
                <Select value={form.templateId || "__none"} onValueChange={(v) => applyTemplate(v === "__none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— none, write from scratch —</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Format</Label>
                <Select
                  value={form.contentType}
                  onValueChange={(v) => setForm({ ...form, contentType: v as typeof form.contentType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="plain">Plain text</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="body">
                Body — use {"{{Subscriber.Email}}"}, {"{{Subscriber.Name}}"}, {"{{Subscriber.FirstName}}"}
              </Label>
              <Textarea
                id="body"
                className="font-mono"
                rows={12}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
              />
            </div>
          </>
        )}

        {step === "Tracking" && (
          <>
            <h3 className="text-sm font-semibold text-foreground">Tracking</h3>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/80">
              <Checkbox
                checked={form.trackOpens}
                onCheckedChange={(checked) => setForm({ ...form, trackOpens: !!checked })}
              />
              Track opens
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/80">
              <Checkbox
                checked={form.trackClicks}
                onCheckedChange={(checked) => setForm({ ...form, trackClicks: !!checked })}
              />
              Track link clicks
            </label>
            <p className="text-xs text-muted-foreground">
              Opens are tracked via an invisible pixel; clicks via a redirect link — both are per-recipient, so turning
              either off applies to this whole letter.
            </p>
          </>
        )}

        {step === "Schedule" && (
          <>
            <h3 className="text-sm font-semibold text-foreground">Schedule</h3>
            <div className="flex max-w-xs flex-col gap-1.5">
              <Label htmlFor="send-at">Send at (leave empty to send immediately after creating)</Label>
              <Input
                id="send-at"
                type="datetime-local"
                value={form.sendAt}
                onChange={(e) => setForm({ ...form, sendAt: e.target.value })}
              />
            </div>
          </>
        )}

        {step === "Review" && (
          <>
            <h3 className="text-sm font-semibold text-foreground">Review</h3>
            <dl className="grid grid-cols-[140px,1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{form.name || "—"}</dd>
              <dt className="text-muted-foreground">From</dt>
              <dd>{form.fromEmail || "—"}</dd>
              <dt className="text-muted-foreground">Subject</dt>
              <dd>{form.subject || "—"}</dd>
              <dt className="text-muted-foreground">Lists</dt>
              <dd>{form.listIds.size ? lists.filter((l) => form.listIds.has(l.id)).map((l) => l.name).join(", ") : "—"}</dd>
              <dt className="text-muted-foreground">Ad-hoc recipients</dt>
              <dd>{splitEmails(form.toEmails).length || 0}</dd>
              <dt className="text-muted-foreground">Tracking</dt>
              <dd>
                {form.trackOpens ? "Opens" : null}
                {form.trackOpens && form.trackClicks ? " + " : null}
                {form.trackClicks ? "Clicks" : null}
                {!form.trackOpens && !form.trackClicks ? "Off" : null}
              </dd>
              <dt className="text-muted-foreground">Schedule</dt>
              <dd>{form.sendAt ? new Date(form.sendAt).toLocaleString() : "Send immediately after creating"}</dd>
            </dl>
            <p className="text-xs text-muted-foreground">
              A pre-flight check (sender DNS, mailbox status, recipient count, unresolved variables) runs automatically
              when you hit Send from the campaigns list — this just creates the letter.
            </p>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="mt-2 flex items-center gap-3">
          {stepIndex > 0 && (
            <Button type="button" variant="outline" onClick={goBack}>
              Back
            </Button>
          )}
          {step !== "Review" ? (
            <Button type="button" onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Creating…" : form.sendAt ? "Schedule letter" : "Create letter"}
            </Button>
          )}
          <Button type="button" variant="outline" className="ml-auto" onClick={() => router.push("/campaigns")}>
            Cancel
          </Button>
        </div>
      </Card>
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
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              i === current
                ? "bg-primary text-primary-foreground"
                : i < current
                ? "bg-primary/10 text-primary hover:bg-primary/20"
                : "bg-muted text-muted-foreground"
            )}
          >
            {i < current ? <CheckIcon width={12} height={12} /> : <span>{i + 1}</span>}
            {label}
          </button>
          {i < steps.length - 1 && <div className={cn("h-px flex-1", i < current ? "bg-primary/40" : "bg-border")} />}
        </div>
      ))}
    </div>
  );
}
