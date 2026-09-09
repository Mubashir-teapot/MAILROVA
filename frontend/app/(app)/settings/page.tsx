"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/api/client";

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

      <form onSubmit={handleSaveRate} className="card flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sending</h3>
        <label className="label max-w-xs">
          Send rate (emails per minute)
          <input
            type="number"
            min={1}
            className="input"
            value={sendRate}
            onChange={(e) => setSendRate(Number(e.target.value))}
          />
        </label>
        <p className="text-xs text-slate-400">
          Throttles how fast campaigns send, on top of each domain's/mailbox's daily limit. Takes effect on the very
          next message sent — no restart needed.
        </p>
        {rateSaved && <p className="text-xs text-green-600">Saved.</p>}
        <button type="submit" className="btn w-fit" disabled={savingRate}>
          {savingRate ? "Saving…" : "Save"}
        </button>
      </form>

      <form onSubmit={handleSaveJson} className="card flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">All settings (advanced)</h3>
        <textarea rows={16} className="input font-mono" value={json} onChange={(e) => setJson(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-xs text-green-600">Saved.</p>}
        <button type="submit" className="btn w-fit">
          Save raw JSON
        </button>
      </form>
    </div>
  );
}
