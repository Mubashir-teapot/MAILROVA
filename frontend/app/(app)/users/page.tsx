"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { CrudTable } from "@/components/CrudTable";

interface Role {
  id: number;
  name: string;
}

export default function Users() {
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    api.get("/roles").then(({ data }) => setRoles(data));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Users</h2>
        <p className="text-sm text-muted-foreground">
          People who can log into this admin — teammates, not subscribers. What each one can see and do is set by
          their Role (see the Roles page).
        </p>
      </div>
      <CrudTable
        resourcePath="/users"
        columns={[
          { key: "username", label: "Username" },
          { key: "email", label: "Email" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "roleId", label: "Role", render: (r) => roles.find((role) => role.id === r.roleId)?.name ?? "—" },
        ]}
        formFields={[
          { name: "username", label: "Username", required: true },
          { name: "email", label: "Email", required: true },
          { name: "password", label: "Password" },
          {
            name: "roleId",
            label: "Role",
            type: "select",
            numeric: true,
            placeholder: "Select a role…",
            options: roles.map((r) => ({ value: String(r.id), label: r.name })),
          },
        ]}
      />
    </div>
  );
}
