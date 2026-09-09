"use client";

import { createElement } from "react";
import { Block } from "./blocks";
import { ArrowDownIcon, ArrowUpIcon, DuplicateIcon, GripIcon, MediaIcon, TrashIcon } from "@/components/icons";

interface Props {
  block: Block;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  dragging: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Block>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}

export function BlockView({
  block,
  selected,
  isFirst,
  isLast,
  dragging,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onClick={onSelect}
      className={`group relative rounded-md border-2 transition-colors ${
        selected ? "border-accent" : "border-transparent hover:border-slate-200"
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div
        className={`absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 shadow-sm transition-opacity ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <span className="cursor-grab px-1 text-slate-400" title="Drag to reorder">
          <GripIcon width={14} height={14} />
        </span>
        <button type="button" onClick={() => onMove(-1)} disabled={isFirst} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
          <ArrowUpIcon width={13} height={13} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={isLast} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30">
          <ArrowDownIcon width={13} height={13} />
        </button>
        <button type="button" onClick={onDuplicate} className="p-1 text-slate-400 hover:text-slate-700">
          <DuplicateIcon width={13} height={13} />
        </button>
        <button type="button" onClick={onDelete} className="p-1 text-slate-400 hover:text-red-600">
          <TrashIcon width={13} height={13} />
        </button>
      </div>

      <div className="p-1">
        <BlockContent block={block} onChange={onChange} />
      </div>
    </div>
  );
}

function BlockContent({ block, onChange }: { block: Block; onChange: (patch: Partial<Block>) => void }) {
  switch (block.type) {
    case "heading": {
      const Tag = (`h${block.level}` as unknown) as "h1";
      return (
        <div style={{ padding: "16px 20px 6px", textAlign: block.align }}>
          <EditableText
            as={Tag}
            html={block.text}
            style={{ color: block.color, fontWeight: 700, fontFamily: "Arial, sans-serif", margin: 0 }}
            onChange={(text) => onChange({ text })}
          />
        </div>
      );
    }
    case "text":
      return (
        <div style={{ padding: "6px 20px" }}>
          <EditableText
            as="div"
            html={block.html}
            style={{
              color: block.color,
              fontSize: block.fontSize,
              textAlign: block.align,
              fontFamily: "Arial, sans-serif",
              lineHeight: 1.6,
            }}
            onChange={(html) => onChange({ html })}
            multiline
          />
        </div>
      );
    case "image":
      return (
        <div style={{ padding: "6px 20px", textAlign: block.align }}>
          {block.src ? (
            <img src={block.src} alt={block.alt} style={{ maxWidth: "100%", width: block.width, display: "inline-block" }} />
          ) : (
            <div className="flex aspect-[3/1] w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-300">
              <MediaIcon width={28} height={28} />
            </div>
          )}
        </div>
      );
    case "button":
      return (
        <div style={{ padding: "12px 20px", textAlign: block.align }}>
          <span
            style={{
              background: block.bgColor,
              color: block.textColor,
              padding: "10px 22px",
              borderRadius: 6,
              display: "inline-block",
              fontFamily: "Arial, sans-serif",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {block.text}
          </span>
        </div>
      );
    case "divider":
      return (
        <div style={{ padding: "8px 20px" }}>
          <hr style={{ border: "none", borderTop: `${block.thickness}px solid ${block.color}` }} />
        </div>
      );
    case "spacer":
      return <div style={{ height: block.height }} />;
  }
}

function EditableText({
  as: Tag,
  html,
  style,
  onChange,
}: {
  as: "h1" | "h2" | "h3" | "div";
  html: string;
  style: React.CSSProperties;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  // Dynamic tag + contentEditable's DOM-level props don't type-check cleanly
  // against JSX.IntrinsicElements' per-tag event handler overloads — build
  // the element directly instead of fighting the union.
  return createElement(Tag, {
    contentEditable: true,
    suppressContentEditableWarning: true,
    style,
    className: "outline-none focus:ring-1 focus:ring-accent/40 rounded-sm",
    onBlur: (e: React.FocusEvent<HTMLElement>) => onChange(e.currentTarget.innerHTML),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    dangerouslySetInnerHTML: { __html: html },
  });
}