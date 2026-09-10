"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Settings() {
  const [sendRate, setSendRate] = useState(60);
  const [savingRate, setSavingRate] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);

  const [json, setJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function load() {
    api.get("/settings").then(({ data }) => {
      setJson(JSON.stringify(data, null, 2));
      if (typeof data.send_rate_per_minute === "number") setSendRate(data.send_rate_per_minute);
    });
  }

  useEffect(load, []);

  async function handleSaveRate(e: FormEvent) {
    e.preventDefault();
    setSavingRate(true);
    setRateSaved(false);
    try {
      await api.put("/settings", { send_rate_per_minute: sendRate });
      setRateSaved(true);
      load();
    } finally {
      setSavingRate(false);
    }
  }

  async function handleSaveJson(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      const parsed = JSON.parse(json);
      await api.put("/settings", parsed);
      setSaved(true);
      load();
    } catch {
      setError("Invalid JSON");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="page-title">Settings</h2>

      <Card className="p-5">
        <form onSubmit={handleSaveRate} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Sending</h3>
          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="send-rate">Send rate (emails per minute)</Label>
            <Input
              id="send-rate"
              type="number"
              min={1}
              value={sendRate}
              onChange={(e) => setSendRate(Number(e.target.value))}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Throttles how fast campaigns send, on top of each domain's/mailbox's daily limit. Takes effect on the very
            next message sent — no restart needed.
          </p>
          {rateSaved && <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved.</p>}
          <Button type="submit" className="w-fit" disabled={savingRate}>
            {savingRate ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <form onSubmit={handleSaveJson} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">All settings (advanced)</h3>
          <Textarea rows={16} className="font-mono" value={json} onChange={(e) => setJson(e.target.value)} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved.</p>}
          <Button type="submit" className="w-fit">
            Save raw JSON
          </Button>
        </form>
      </Card>
    </div>
  );
}
