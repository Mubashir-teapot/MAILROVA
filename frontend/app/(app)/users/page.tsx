"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { CrudTable } from "@/components/CrudTable";

interface Role {
  id: number;
  name: string;
}

interface Mailbox {
  email: string;
  users: { user: { id: number } }[];
}

export default function Users() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);

  useEffect(() => {
    api.get("/roles").then(({ data }) => setRoles(data));
    api.get("/mailboxes").then(({ data }) => setMailboxes(data));
  }, []);

  function mailboxesFor(userId: number) {
    return mailboxes.filter((m) => m.users.some((u) => u.user.id === userId)).map((m) => m.email);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Users</h2>
        <p className="text-sm text-muted-foreground">
          People who can log into this admin. Teammates, not subscribers. What each one can see and do is set by
          their Role (see the Roles page). Their contact email here is unrelated to what a campaign sends from,
          that's a mailbox (see the Mailboxes page), assigned to a user separately.
        </p>
      </div>
      <CrudTable
        resourcePath="/users"
        columns={[
          { key: "username", label: "Username" },
          { key: "email", label: "Contact email" },
          { key: "type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "roleId", label: "Role", render: (r) => roles.find((role) => role.id === r.roleId)?.name ?? "-" },
          {
            key: "mailboxes",
            label: "Sends campaigns from",
            render: (r) => {
              const emails = mailboxesFor(r.id);
              return emails.length ? emails.join(", ") : "-";
            },
          },
        ]}
        formFields={[
          { name: "username", label: "Username", required: true },
          { name: "email", label: "Contact email (not a sending address, see Mailboxes for that)", required: true },
          { name: "password", label: "Password", editOptional: true },
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
