"use client";

import { ChangeEvent } from "react";
import { api } from "@/api/client";
import { Block } from "./blocks";

interface MediaItem {
  id: number;
  url: string;
  filename: string;
}

interface Props {
  block: Block | null;
  media: MediaItem[];
  onLoadMedia: () => void;
  onChange: (patch: Partial<Block>) => void;
}

const ALIGN_OPTIONS: { value: "left" | "center" | "right"; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const VARIABLES = [
  { token: "{{Subscriber.Name}}", label: "Subscriber name" },
  { token: "{{Subscriber.Email}}", label: "Subscriber email" },
  { token: "{{Campaign.Name}}", label: "Campaign name" },
  { token: "{{Campaign.Subject}}", label: "Campaign subject" },
  { token: "{{UnsubscribeUrl}}", label: "Unsubscribe link" },
];

export function Inspector({ block, media, onLoadMedia, onChange }: Props) {
  if (!block) {
    return (
      <div className="card sticky top-6 flex flex-col gap-2 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Properties</h3>
        <p className="text-xs text-slate-400 dark:text-slate-500">Select a block on the left to edit it.</p>
      </div>
    );
  }

  return (
    <div className="card sticky top-6 flex flex-col gap-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold capitalize text-slate-900 dark:text-slate-100">{block.type} settings</h3>

      <AlignField value={"align" in block ? block.align : undefined} onChange={(align) => onChange({ align } as Partial<Block>)} />

      {block.type === "heading" && (
        <>
          <label className="label">
            Level
            <select className="input" value={block.level} onChange={(e) => onChange({ level: Number(e.target.value) as 1 | 2 | 3 })}>
              <option value={1}>H1 — large</option>
              <option value={2}>H2 — medium</option>
              <option value={3}>H3 — small</option>
            </select>
          </label>
          <ColorField label="Color" value={block.color} onChange={(color) => onChange({ color })} />
          <VariablesField onInsert={(token) => onChange({ text: block.text + token } as Partial<Block>)} />
        </>
      )}

      {block.type === "text" && (
        <>
          <label className="label">
            Font size
            <input
              type="number"
              className="input"
              value={block.fontSize}
              min={10}
              max={36}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            />
          </label>
          <ColorField label="Color" value={block.color} onChange={(color) => onChange({ color })} />
          <VariablesField onInsert={(token) => onChange({ html: block.html + token } as Partial<Block>)} />
        </>
      )}

      {block.type === "image" && (
        <>
          <div>
            <span className="label mb-2">Image</span>
            <button type="button" className="btn-ghost w-full" onClick={onLoadMedia}>
              Browse media library
            </button>
            <div className="mt-2 grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto">
              {media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ src: m.url } as Partial<Block>)}
                  className="aspect-square overflow-hidden rounded border border-slate-200 hover:border-accent dark:border-slate-700"
                  title={m.filename}
                >
                  <img src={m.url} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <label className="btn w-full cursor-pointer justify-center text-xs">
            Upload new image
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, onChange)} />
          </label>
          <label className="label">
            Alt text
            <input className="input" value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} />
          </label>
          <label className="label">
            Link URL (optional)
            <input className="input" value={block.link} onChange={(e) => onChange({ link: e.target.value })} />
          </label>
          <label className="label">
            Width (px)
            <input
              type="number"
              className="input"
              value={block.width}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      {block.type === "button" && (
        <>
          <label className="label">
            Text
            <input className="input" value={block.text} onChange={(e) => onChange({ text: e.target.value })} />
          </label>
          <label className="label">
            Link URL
            <input className="input" value={block.url} onChange={(e) => onChange({ url: e.target.value })} />
          </label>
          <ColorField label="Background" value={block.bgColor} onChange={(bgColor) => onChange({ bgColor })} />
          <ColorField label="Text color" value={block.textColor} onChange={(textColor) => onChange({ textColor })} />
          <VariablesField onInsert={(token) => onChange({ text: block.text + token } as Partial<Block>)} />
        </>
      )}

      {block.type === "divider" && (
        <>
          <ColorField label="Color" value={block.color} onChange={(color) => onChange({ color })} />
          <label className="label">
            Thickness (px)
            <input
              type="number"
              className="input"
              value={block.thickness}
              min={1}
              max={8}
              onChange={(e) => onChange({ thickness: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      {block.type === "spacer" && (
        <label className="label">
          Height (px)
          <input
            type="number"
            className="input"
            value={block.height}
            min={4}
            max={120}
            onChange={(e) => onChange({ height: Number(e.target.value) })}
          />
        </label>
      )}
    </div>
  );
}

function AlignField({ value, onChange }: { value?: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  if (!value) return null;
  return (
    <div>
      <span className="label mb-2">Alignment</span>
      <div className="flex gap-1.5">
        {ALIGN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs ${
              value === opt.value
                ? "border-accent bg-blue-50 text-accent dark:bg-blue-500/10"
                : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Appends the chosen token to the block's text — simpler and more robust
// than cursor-position tracking inside a contentEditable element, at the
// cost of always landing at the end rather than wherever the cursor was.
function VariablesField({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <label className="label">
      Insert variable
      <select
        className="input"
        value=""
        onChange={(e) => {
          if (e.target.value) onInsert(e.target.value);
          e.target.value = "";
        }}
      >
        <option value="" disabled>
          Choose…
        </option>
        {VARIABLES.map((v) => (
          <option key={v.token} value={v.token}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="label">
      {label}
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded border border-slate-300 dark:border-slate-700" />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}

async function handleUpload(e: ChangeEvent<HTMLInputElement>, onChange: (patch: Partial<Block>) => void) {
  const file = e.target.files?.[0];
  if (!file) return;
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/media", form, { headers: { "Content-Type": "multipart/form-data" } });
  onChange({ src: data.url } as Partial<Block>);
  e.target.value = "";
}