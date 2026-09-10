"use client";

import { CrudTable } from "@/components/CrudTable";

export default function Lists() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Lists</h2>
        <p className="text-sm text-muted-foreground">
          Groups of subscribers you send campaigns to — e.g. "Newsletter" or "Customers". A subscriber can belong to
          several lists at once.
        </p>
      </div>
      <CrudTable
        resourcePath="/lists"
        columns={[
          { key: "name", label: "Name" },
          { key: "type", label: "Type" },
          { key: "optin", label: "Opt-in" },
          { key: "status", label: "Status" },
        ]}
        formFields={[
          { name: "name", label: "Name", required: true },
          { name: "type", label: "Type (public/private)" },
          { name: "optin", label: "Opt-in (single/double)" },
        ]}
      />
    </div>
  );
}
