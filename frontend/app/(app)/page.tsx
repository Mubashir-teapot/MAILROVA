"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/api/client";
import { CampaignIcon, ListIcon, UsersIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";

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
        { label: "Subscribers", value: counts.subscribers, icon: UsersIcon, href: "/subscribers" },
        { label: "Lists", value: counts.lists, icon: ListIcon, href: "/lists" },
        { label: "Campaigns", value: counts.campaigns, icon: CampaignIcon, href: "/campaigns" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Dashboard</h2>
        <p className="text-sm text-muted-foreground">A quick look at where things stand. Click any card to jump there.</p>
      </div>
      <div className="flex flex-wrap gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="flex min-w-[160px] items-center gap-3 p-5 transition-colors hover:border-primary/40">
              <span className="rounded-md bg-primary/10 p-2 text-primary">
                <c.icon width={22} height={22} />
              </span>
              <div>
                <strong className="block text-2xl text-foreground">{c.value}</strong>
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
