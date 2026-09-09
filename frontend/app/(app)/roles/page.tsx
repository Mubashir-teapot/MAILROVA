"use client";

import { CrudTable } from "@/components/CrudTable";

export default function Roles() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="page-title">Roles</h2>
      <CrudTable
        resourcePath="/roles"
        columns={[
          { key: "name", label: "Name" },
          { key: "type", label: "Type" },
          { key: "permissions", label: "Permissions", render: (r) => r.permissions.join(", ") },
        ]}
        formFields={[{ name: "name", label: "Name", required: true }]}
      />
    </div>
  );
}
