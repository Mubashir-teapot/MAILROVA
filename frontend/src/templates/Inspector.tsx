"use client";

import { ChangeEvent } from "react";
import { api } from "@/api/client";
import { Block } from "./blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
      <Card className="sticky top-6 flex flex-col gap-2 p-5">
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
        <p className="text-xs text-muted-foreground">Select a block on the left to edit it.</p>
      </Card>
    );
  }

  return (
    <Card className="sticky top-6 flex flex-col gap-4 p-5">
      <h3 className="text-sm font-semibold capitalize text-foreground">{block.type} settings</h3>

      <AlignField value={"align" in block ? block.align : undefined} onChange={(align) => onChange({ align } as Partial<Block>)} />

      {block.type === "heading" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Level</Label>
            <Select value={String(block.level)} onValueChange={(v) => onChange({ level: Number(v) as 1 | 2 | 3 })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">H1 — large</SelectItem>
                <SelectItem value="2">H2 — medium</SelectItem>
                <SelectItem value="3">H3 — small</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ColorField label="Color" value={block.color} onChange={(color) => onChange({ color })} />
          <VariablesField onInsert={(token) => onChange({ text: block.text + token } as Partial<Block>)} />
        </>
      )}

      {block.type === "text" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="font-size">Font size</Label>
            <Input
              id="font-size"
              type="number"
              value={block.fontSize}
              min={10}
              max={36}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            />
          </div>
          <ColorField label="Color" value={block.color} onChange={(color) => onChange({ color })} />
          <VariablesField onInsert={(token) => onChange({ html: block.html + token } as Partial<Block>)} />
        </>
      )}

      {block.type === "image" && (
        <>
          <div>
            <Label className="mb-2 inline-block">Image</Label>
            <Button type="button" variant="outline" className="w-full" onClick={onLoadMedia}>
              Browse media library
            </Button>
            <div className="mt-2 grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto">
              {media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ src: m.url } as Partial<Block>)}
                  className="aspect-square overflow-hidden rounded border border-border hover:border-primary"
                  title={m.filename}
                >
                  <img src={m.url} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" className="w-full cursor-pointer justify-center text-xs" asChild>
            <label>
              Upload new image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, onChange)} />
            </label>
          </Button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="img-alt">Alt text</Label>
            <Input id="img-alt" value={block.alt} onChange={(e) => onChange({ alt: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="img-link">Link URL (optional)</Label>
            <Input id="img-link" value={block.link} onChange={(e) => onChange({ link: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="img-width">Width (px)</Label>
            <Input
              id="img-width"
              type="number"
              value={block.width}
              onChange={(e) => onChange({ width: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {block.type === "button" && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="btn-text">Text</Label>
            <Input id="btn-text" value={block.text} onChange={(e) => onChange({ text: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="btn-url">Link URL</Label>
            <Input id="btn-url" value={block.url} onChange={(e) => onChange({ url: e.target.value })} />
          </div>
          <ColorField label="Background" value={block.bgColor} onChange={(bgColor) => onChange({ bgColor })} />
          <ColorField label="Text color" value={block.textColor} onChange={(textColor) => onChange({ textColor })} />
          <VariablesField onInsert={(token) => onChange({ text: block.text + token } as Partial<Block>)} />
        </>
      )}

      {block.type === "divider" && (
        <>
          <ColorField label="Color" value={block.color} onChange={(color) => onChange({ color })} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="divider-thickness">Thickness (px)</Label>
            <Input
              id="divider-thickness"
              type="number"
              value={block.thickness}
              min={1}
              max={8}
              onChange={(e) => onChange({ thickness: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {block.type === "spacer" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spacer-height">Height (px)</Label>
          <Input
            id="spacer-height"
            type="number"
            value={block.height}
            min={4}
            max={120}
            onChange={(e) => onChange({ height: Number(e.target.value) })}
          />
        </div>
      )}
    </Card>
  );
}

function AlignField({ value, onChange }: { value?: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  if (!value) return null;
  return (
    <div>
      <Label className="mb-2 inline-block">Alignment</Label>
      <div className="flex gap-1.5">
        {ALIGN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-md border px-2 py-1.5 text-xs",
              value === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/20"
            )}
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
// Never persisting a selected value keeps the trigger showing the
// placeholder after every pick, mirroring the old reset-after-select native
// <select> behavior.
function VariablesField({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Insert variable</Label>
      <Select value="" onValueChange={(v) => v && onInsert(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {VARIABLES.map((v) => (
            <SelectItem key={v.token} value={v.token}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 rounded border border-input" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
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
