"use client";

import { CrudTable } from "@/components/CrudTable";

export default function Suppressions() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="page-title">Suppressions</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Addresses no campaign or transactional send will ever go to — populated automatically by
        hard bounces, complaints, and unsubscribes, or added here manually.
      </p>
      <CrudTable
        resourcePath="/suppressions"
        columns={[
          { key: "email", label: "Email" },
          { key: "reason", label: "Reason" },
          { key: "createdAt", label: "Added", render: (r) => new Date(r.createdAt).toLocaleString() },
        ]}
        formFields={[{ name: "email", label: "Email", required: true }]}
      />
    </div>
  );
}
