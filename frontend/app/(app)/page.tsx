"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/api/client";
import { CampaignIcon, ListIcon, UsersIcon } from "@/components/icons";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Loading } from "@/components/States";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  status: string;
  sent: number;
}

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  draft: "secondary",
  scheduled: "warning",
  running: "info",
  paused: "warning",
  finished: "success",
  cancelled: "destructive",
};

export default function Dashboard() {
  const [counts, setCounts] = useState<{ subscribers: number; lists: number; campaigns: number } | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    Promise.all([api.get("/subscribers?perPage=1"), api.get("/lists"), api.get("/campaigns")]).then(
      ([subs, lists, campaigns]) => {
        setCounts({
          subscribers: subs.data.total,
          lists: lists.data.length,
          campaigns: campaigns.data.length,
        });
        setRecentCampaigns(campaigns.data.slice(-5).reverse());
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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="text-sm text-muted-foreground">A quick look at where things stand. Click any card to jump there.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/subscribers">Add subscriber</Link>
          </Button>
          <Button asChild>
            <Link href="/campaigns/new">New campaign</Link>
          </Button>
        </div>
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

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Recent campaigns</h3>
        {recentCampaigns === null ? (
          <Loading />
        ) : recentCampaigns.length === 0 ? (
          <Card className="p-5">
            <EmptyState message="No campaigns yet. Create one to see it here." />
          </Card>
        ) : (
          <Card className="divide-y divide-border p-0">
            {recentCampaigns.map((c) => (
              <Link
                key={c.id}
                href="/campaigns"
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.subject}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">{c.sent} sent</span>
                  <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
