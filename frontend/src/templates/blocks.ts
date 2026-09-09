export type Align = "left" | "center" | "right";

interface BlockBase {
  id: string;
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  align: Align;
  color: string;
}

export interface TextBlock extends BlockBase {
  type: "text";
  html: string;
  align: Align;
  color: string;
  fontSize: number;
}

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string;
  alt: string;
  link: string;
  width: number;
  align: Align;
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  text: string;
  url: string;
  bgColor: string;
  textColor: string;
  align: Align;
}

export interface DividerBlock extends BlockBase {
  type: "divider";
  color: string;
  thickness: number;
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  height: number;
}

export type Block = HeadingBlock | TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock;
export type BlockType = Block["type"];

export interface TemplateDoc {
  blocks: Block[];
  backgroundColor: string;
  contentWidth: number;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
};

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "heading":
      return { id, type, text: "Your heading", level: 2, align: "left", color: "#0f172a" };
    case "text":
      return { id, type, html: "Write your message here.", align: "left", color: "#334155", fontSize: 15 };
    case "image":
      return { id, type, src: "", alt: "", link: "", width: 560, align: "center" };
    case "button":
      return { id, type, text: "Click here", url: "https://", bgColor: "#1d4ed8", textColor: "#ffffff", align: "left" };
    case "divider":
      return { id, type, color: "#e2e8f0", thickness: 1 };
    case "spacer":
      return { id, type, height: 24 };
  }
}

export function emptyDoc(): TemplateDoc {
  return {
    backgroundColor: "#f1f5f9",
    contentWidth: 600,
    blocks: [
      { id: newId(), type: "heading", text: "Hi {{Subscriber.FirstName}},", level: 2, align: "left", color: "#0f172a" },
      { id: newId(), type: "text", html: "Write your message here.", align: "left", color: "#334155", fontSize: 15 },
    ],
  };
}

// Compiles the block document into standalone, table-based, inline-styled
// HTML — the layout approach that survives the widest range of e-mail
// clients (Outlook desktop in particular chokes on modern CSS/flex/grid).
export function compileDoc(doc: TemplateDoc): string {
  const rows = doc.blocks.map(renderBlockRow).join("\n");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${doc.backgroundColor};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${doc.backgroundColor};">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="${doc.contentWidth}" cellpadding="0" cellspacing="0" style="width:${doc.contentWidth}px;max-width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
${rows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderBlockRow(block: Block): string {
  switch (block.type) {
    case "heading": {
      const size = block.level === 1 ? 28 : block.level === 2 ? 22 : 18;
      return cell(
        `<h${block.level} style="margin:0;font-family:Arial,sans-serif;font-size:${size}px;font-weight:700;color:${block.color};text-align:${block.align};">${block.text}</h${block.level}>`,
        "20px 24px 8px"
      );
    }
    case "text":
      return cell(
        `<div style="font-family:Arial,sans-serif;font-size:${block.fontSize}px;line-height:1.6;color:${block.color};text-align:${block.align};">${block.html}</div>`,
        "8px 24px"
      );
    case "image": {
      const img = `<img src="${block.src}" alt="${block.alt}" width="${block.width}" style="max-width:100%;display:inline-block;border:0;" />`;
      return cell(
        `<div style="text-align:${block.align};">${block.link ? `<a href="${block.link}">${img}</a>` : img}</div>`,
        "8px 24px"
      );
    }
    case "button":
      return cell(
        `<div style="text-align:${block.align};"><a href="${block.url}" style="background:${block.bgColor};color:${block.textColor};font-family:Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:6px;display:inline-block;">${block.text}</a></div>`,
        "16px 24px"
      );
    case "divider":
      return cell(`<hr style="border:none;border-top:${block.thickness}px solid ${block.color};margin:0;" />`, "8px 24px");
    case "spacer":
      return `          <tr><td style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</td></tr>`;
  }
}

function cell(inner: string, padding: string): string {
  return `          <tr><td style="padding:${padding};">${inner}</td></tr>`;
}
