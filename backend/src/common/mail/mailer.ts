import nodemailer from "nodemailer";
import { env } from "../../config/env";
import { sanitizeEmailHtml } from "../utils/sanitizeEmailHtml";

// ponytail: one shared SMTP transport. The source app's multi-server round-robin
// pool + per-from-address routing isn't reimplemented here — add a pool per
// server (Settings -> SMTP) if you need to spread volume across providers.
const transport = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.secure,
  tls: env.smtp.tls,
  auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
});

export interface SendMailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
  // VERP return-path (see campaigns.worker.ts) — the SMTP envelope sender
  // (MAIL FROM), distinct from the visible "From:" header. When set, any
  // bounce DSN the receiving server generates comes back to this unique
  // address instead of `from`, which is how a bounce gets correlated back
  // to the exact campaign+recipient that caused it (see mta/ + the
  // /webhooks/bounce/postfix handler).
  envelopeFrom?: string;
}

export async function sendMail(input: SendMailInput) {
  return transport.sendMail({
    from: input.from ?? env.smtp.fromEmail,
    envelope: input.envelopeFrom ? { from: input.envelopeFrom, to: input.to } : undefined,
    to: input.to,
    cc: input.cc?.length ? input.cc : undefined,
    bcc: input.bcc?.length ? input.bcc : undefined,
    subject: input.subject,
    html: input.html !== undefined ? sanitizeEmailHtml(input.html) : undefined,
    text: input.text,
    headers: input.headers,
    attachments: input.attachments,
  });
}
