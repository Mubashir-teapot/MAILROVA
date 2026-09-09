"use client";

import { CrudTable } from "@/components/CrudTable";

export default function Users() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="page-title">Users</h2>
      <CrudTable
        resourcePath="/users"
        columns={[
          { key: "username", label: "Username" },
          { key: "email", label: "Email" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
        ]}
        formFields={[
          { name: "username", label: "Username", required: true },
          { name: "email", label: "Email", required: true },
          { name: "password", label: "Password" },
          { name: "roleId", label: "Role ID", type: "number" },
        ]}
      />
    </div>
  );
}
