"use client";

import { useRef, useState } from "react";
import { api } from "@/api/client";
import {
  ArrowDownIcon,
  ButtonBlockIcon,
  DividerBlockIcon,
  HeadingIcon,
  MediaIcon,
  SpacerBlockIcon,
  TextBlockIcon,
} from "@/components/icons";
import { Block, BLOCK_LABELS, BlockType, compileDoc, createBlock, TemplateDoc } from "./blocks";
import { BlockView } from "./BlockView";
import { Inspector } from "./Inspector";

const ADD_BUTTONS: { type: BlockType; icon: typeof HeadingIcon }[] = [
  { type: "heading", icon: HeadingIcon },
  { type: "text", icon: TextBlockIcon },
  { type: "image", icon: MediaIcon },
  { type: "button", icon: ButtonBlockIcon },
  { type: "divider", icon: DividerBlockIcon },
  { type: "spacer", icon: SpacerBlockIcon },
];

interface MediaItem {
  id: number;
  url: string;
  filename: string;
}

interface Props {
  doc: TemplateDoc;
  onChange: (doc: TemplateDoc) => void;
}

export function VisualEditor({ doc, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(doc.blocks[0]?.id ?? null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const dragIndex = useRef<number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  function loadMedia() {
    api.get("/media").then(({ data }) => setMedia(data));
  }

  function updateBlocks(blocks: Block[]) {
    onChange({ ...doc, blocks });
  }

  function addBlock(type: BlockType) {
    const block = createBlock(type);
    const index = doc.blocks.findIndex((b) => b.id === selectedId);
    const blocks = [...doc.blocks];
    blocks.splice(index === -1 ? blocks.length : index + 1, 0, block);
    updateBlocks(blocks);
    setSelectedId(block.id);
  }

  function patchBlock(id: string, patch: Partial<Block>) {
    updateBlocks(doc.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  }

  function deleteBlock(id: string) {
    updateBlocks(doc.blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateBlock(id: string) {
    const index = doc.blocks.findIndex((b) => b.id === id);
    if (index === -1) return;
    const copy = { ...doc.blocks[index], id: Math.random().toString(36).slice(2, 10) };
    const blocks = [...doc.blocks];
    blocks.splice(index + 1, 0, copy);
    updateBlocks(blocks);
    setSelectedId(copy.id);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const index = doc.blocks.findIndex((b) => b.id === id);
    const target = index + dir;
    if (index === -1 || target < 0 || target >= doc.blocks.length) return;
    const blocks = [...doc.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    updateBlocks(blocks);
  }

  function reorderByDrag(targetId: string) {
    if (dragIndex.current === null) return;
    const from = dragIndex.current;
    const to = doc.blocks.findIndex((b) => b.id === targetId);
    if (from === to || to === -1) return;
    const blocks = [...doc.blocks];
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    updateBlocks(blocks);
    dragIndex.current = to;
  }

  const selectedBlock = doc.blocks.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-[1fr,280px] gap-5">
      <div className="flex flex-col gap-4">
        <div className="card flex flex-wrap items-center gap-2 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-400">Add block</span>
          {ADD_BUTTONS.map((b) => (
            <button key={b.type} type="button" onClick={() => addBlock(b.type)} className="btn-ghost">
              <b.icon width={14} height={14} />
              {BLOCK_LABELS[b.type]}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn-ghost" onClick={() => setPreview((v) => !v)}>
              {preview ? "Back to editing" : "Preview"}
            </button>
            <label className="text-xs text-slate-400">Background</label>
            <input
              type="color"
              value={doc.backgroundColor}
              onChange={(e) => onChange({ ...doc, backgroundColor: e.target.value })}
              className="h-7 w-9 rounded border border-slate-300 dark:border-slate-700"
            />
          </div>
        </div>

        {preview ? (
          <iframe
            title="Template preview"
            srcDoc={compileDoc(doc)}
            sandbox=""
            className="min-h-[520px] w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
          />
        ) : (
          <div className="rounded-xl border border-slate-200 p-6 dark:border-slate-800" style={{ background: doc.backgroundColor }}>
            <div
              className="mx-auto flex flex-col rounded-lg bg-white shadow-sm"
              style={{ width: doc.contentWidth, maxWidth: "100%" }}
              onClick={() => setSelectedId(null)}
            >
              {doc.blocks.map((block, i) => (
                <div key={block.id} onClick={(e) => e.stopPropagation()}>
                  <BlockView
                    block={block}
                    selected={block.id === selectedId}
                    isFirst={i === 0}
                    isLast={i === doc.blocks.length - 1}
                    dragging={dragOverId === block.id}
                    onSelect={() => setSelectedId(block.id)}
                    onChange={(patch) => patchBlock(block.id, patch)}
                    onDelete={() => deleteBlock(block.id)}
                    onDuplicate={() => duplicateBlock(block.id)}
                    onMove={(dir) => moveBlock(block.id, dir)}
                    onDragStart={() => {
                      dragIndex.current = i;
                    }}
                    onDragOver={() => setDragOverId(block.id)}
                    onDrop={() => {
                      reorderByDrag(block.id);
                      setDragOverId(null);
                    }}
                  />
                </div>
              ))}
              {!doc.blocks.length && (
                <div className="flex h-40 items-center justify-center gap-1 p-6 text-sm text-slate-300">
                  <ArrowDownIcon width={14} height={14} />
                  Add a block above to start designing
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Inspector block={selectedBlock} media={media} onLoadMedia={loadMedia} onChange={(patch) => selectedId && patchBlock(selectedId, patch)} />
    </div>
  );
}