"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Bounce {
  id: number;
  type: string;
  source: string;
  createdAt: string;
  subscriber: { email: string };
}

const TYPE_VARIANT: Record<string, BadgeProps["variant"]> = {
  hard: "destructive",
  soft: "warning",
  complaint: "secondary",
};

const TYPE_CLASS: Record<string, string> = {
  complaint: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export default function Bounces() {
  const [bounces, setBounces] = useState<Bounce[]>([]);

  useEffect(() => {
    api.get("/bounces").then(({ data }) => setBounces(data));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Bounces</h2>
        <p className="text-sm text-muted-foreground">
          Delivery failures reported back by receiving mail servers. Read-only log, recorded automatically as
          campaigns and transactional mail send. Repeated hard bounces or complaints add an address to Suppressions.
        </p>
      </div>
      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bounces.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.subscriber.email}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[b.type]} className={cn(TYPE_CLASS[b.type])}>
                    {b.type}
                  </Badge>
                </TableCell>
                <TableCell>{b.source}</TableCell>
                <TableCell>{new Date(b.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
