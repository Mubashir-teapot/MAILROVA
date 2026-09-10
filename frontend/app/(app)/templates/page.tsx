"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/api/client";
import { TrashIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Template {
  id: number;
  name: string;
  type: string;
  isDefault: boolean;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);

  async function load() {
    const { data } = await api.get("/templates");
    setTemplates(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Delete this template?"))) return;
    await api.delete(`/templates/${id}`);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Templates</h2>
          <p className="text-sm text-muted-foreground">Reusable designs, with images, for letters and transactional mail.</p>
        </div>
        <Button asChild>
          <Link href="/templates/new">New template</Link>
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Default</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/templates/${t.id}`} className="font-medium text-primary hover:underline">
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell>{t.type}</TableCell>
                <TableCell>{t.isDefault ? <Badge>default</Badge> : ""}</TableCell>
                <TableCell className="w-10">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(t.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <TrashIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!templates.length && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No templates yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
