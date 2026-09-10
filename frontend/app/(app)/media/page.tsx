"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { MediaIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Loading } from "@/components/States";

interface Media {
  id: number;
  filename: string;
  contentType: string;
  url: string;
}

export default function Media() {
  const [media, setMedia] = useState<Media[] | null>(null);

  async function load() {
    const { data } = await api.get("/media");
    setMedia(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await api.post("/media", form, { headers: { "Content-Type": "multipart/form-data" } });
    e.target.value = "";
    await load();
    toast.success("Uploaded");
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Delete this file?"))) return;
    await api.delete(`/media/${id}`);
    await load();
    toast.success("Deleted");
  }

  function copyUrl(url: string) {
    navigator.clipboard?.writeText(url);
    toast.success("URL copied");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Media</h2>
        <p className="text-sm text-muted-foreground">
          Images you upload once here and reuse anywhere — the template builder's Image block and "Insert image" in raw
          HTML templates both pick from this same library, instead of uploading the same logo or banner over and over.
        </p>
      </div>

      <Button variant="outline" className="w-fit cursor-pointer" asChild>
        <label>
          <UploadIcon width={16} height={16} />
          Upload file
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </label>
      </Button>

      {media === null ? (
        <Loading />
      ) : media.length === 0 ? (
        <Card className="p-5">
          <EmptyState message="No media uploaded yet — upload an image above to use it in templates." />
        </Card>
      ) : (
        <div className="flex flex-wrap gap-3">
          {media.map((m) => (
            <Card key={m.id} className="flex w-40 flex-col gap-2 overflow-hidden p-0">
              <button
                type="button"
                onClick={() => copyUrl(m.url)}
                className="flex aspect-square w-full items-center justify-center bg-muted"
                title="Click to copy URL"
              >
                {m.contentType.startsWith("image/") ? (
                  <img src={m.url} alt={m.filename} className="h-full w-full object-cover" />
                ) : (
                  <MediaIcon width={28} height={28} className="text-muted-foreground" />
                )}
              </button>
              <div className="flex flex-col gap-1.5 p-3 pt-0">
                <span className="w-full truncate text-xs text-foreground" title={m.filename}>
                  {m.filename}
                </span>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-destructive"
                >
                  <TrashIcon width={14} height={14} />
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
