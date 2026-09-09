"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { api } from "@/api/client";
import { MediaIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { confirmDialog } from "@/components/ConfirmDialog";

interface Media {
  id: number;
  filename: string;
  contentType: string;
}

export default function Media() {
  const [media, setMedia] = useState<Media[]>([]);

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
  }

  async function handleDelete(id: number) {
    if (!(await confirmDialog("Delete this file?"))) return;
    await api.delete(`/media/${id}`);
    await load();
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="page-title">Media</h2>
      <label className="btn w-fit cursor-pointer">
        <UploadIcon width={16} height={16} />
        Upload file
        <input type="file" className="hidden" onChange={handleUpload} />
      </label>

      <div className="flex flex-wrap gap-3">
        {media.map((m) => (
          <div key={m.id} className="card flex w-40 flex-col items-center gap-2 text-center">
            <span className="rounded-md bg-accent/10 p-3 text-accent">
              <MediaIcon width={24} height={24} />
            </span>
            <span className="w-full truncate text-xs text-slate-600 dark:text-slate-300">{m.filename}</span>
            <button
              onClick={() => handleDelete(m.id)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
            >
              <TrashIcon width={14} height={14} />
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
