import sanitizeHtml from "sanitize-html";

// Email HTML needs a much looser allowlist than a typical web-page sanitizer
// — table-based layouts and inline styles are how the visual builder
// (frontend/src/templates/blocks.ts compileDoc) renders everything — but
// must never carry <script>, event handlers, or javascript:/data: URLs. This
// is the one choke point every outbound HTML body passes through:
// mailer.sendMail(), campaign/template save-time validation, and preview.
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "html", "head", "body", "meta", "title",
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span", "center", "font", "u", "s", "b", "i", "strong", "em",
      "br", "hr", "a", "img",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "ul", "ol", "li", "blockquote", "pre", "code",
      "style",
    ],
    allowedAttributes: {
      "*": [
        "style", "class", "align", "valign", "width", "height", "bgcolor", "color", "border",
        "cellpadding", "cellspacing", "role", "dir", "lang",
      ],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      font: ["face", "size", "color"],
      meta: ["charset", "name", "content"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "cid"] },
    allowProtocolRelative: false,
    // Every inline event handler (onclick, onerror, ...) is already outside
    // allowedAttributes above and gets stripped; this just documents the intent.
    disallowedTagsMode: "discard",
  });
}

const UNSAFE_HTML_PATTERNS = [/<script/i, /<iframe/i, /<object/i, /<embed/i, /\son\w+\s*=/i, /javascript:/i, /vbscript:/i, /data:text\/html/i];

// Save-time guard for a raw HTML body (template/campaign create+update) —
// fails fast with a clear 400 instead of silently stripping at send time.
// mailer.sendMail() -> sanitizeEmailHtml() above remains the real security
// boundary (this is a cheap early rejection, not a substitute for it).
export function isUnsafeEmailHtml(html: string): boolean {
  return UNSAFE_HTML_PATTERNS.some((pattern) => pattern.test(html));
}

const SAFE_URL_RE = /^(https?:|mailto:)/i;

// Save-time validation for a single link/button URL (visual builder's
// ButtonBlock.url / ImageBlock.link, and any campaign/template Zod schema) —
// rejects javascript:/data:/vbscript: and anything else that isn't a plain
// http(s)/mailto link, before it ever reaches a compiled template body.
export function isSafeLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.length > 0 && SAFE_URL_RE.test(trimmed);
}
