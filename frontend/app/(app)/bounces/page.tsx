"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";

interface Bounce {
  id: number;
  type: string;
  source: string;
  createdAt: string;
  subscriber: { email: string };
}

const TYPE_STYLE: Record<string, string> = {
  hard: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  soft: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  complaint: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
};

export default function Bounces() {
  const [bounces, setBounces] = useState<Bounce[]>([]);

  useEffect(() => {
    api.get("/bounces").then(({ data }) => setBounces(data));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="page-title">Bounces</h2>
      <div className="card overflow-x-auto p-0">
        <table className="table-base">
          <thead>
            <tr>
              <th>Email</th>
              <th>Type</th>
              <th>Source</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {bounces.map((b) => (
              <tr key={b.id}>
                <td>{b.subscriber.email}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[b.type]}`}>
                    {b.type}
                  </span>
                </td>
                <td>{b.source}</td>
                <td>{new Date(b.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
