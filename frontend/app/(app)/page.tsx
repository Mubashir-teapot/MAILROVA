"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { CampaignIcon, ListIcon, UsersIcon } from "@/components/icons";

export default function Dashboard() {
  const [counts, setCounts] = useState<{ subscribers: number; lists: number; campaigns: number } | null>(null);

  useEffect(() => {
    Promise.all([api.get("/subscribers?perPage=1"), api.get("/lists"), api.get("/campaigns")]).then(
      ([subs, lists, campaigns]) => {
        setCounts({
          subscribers: subs.data.total,
          lists: lists.data.length,
          campaigns: campaigns.data.length,
        });
      }
    );
  }, []);

  const cards = counts
    ? [
        { label: "Subscribers", value: counts.subscribers, icon: UsersIcon },
        { label: "Lists", value: counts.lists, icon: ListIcon },
        { label: "Campaigns", value: counts.campaigns, icon: CampaignIcon },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="page-title">Dashboard</h2>
      <div className="flex flex-wrap gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card flex min-w-[160px] items-center gap-3">
            <span className="rounded-md bg-accent/10 p-2 text-accent">
              <c.icon width={22} height={22} />
            </span>
            <div>
              <strong className="block text-2xl text-ink dark:text-white">{c.value}</strong>
              <span className="text-xs text-slate-500 dark:text-slate-400">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
