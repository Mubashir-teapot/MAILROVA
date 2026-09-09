import { parse } from "csv-parse/sync";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../common/utils/ApiError";
import { sendMail } from "../../common/mail/mailer";
import { renderTemplate } from "../../common/utils/renderTemplate";

export interface ImportOptions {
  mode: "subscribe" | "blocklist";
  listIds: number[];
  templateId?: number; // if given, this template is sent to every newly-imported subscriber.
}

export interface ImportResult {
  total: number;
  imported: number;
  emailed: number;
  errors: string[];
}

export const importService = {
  async importCsv(tenantId: number, csvText: string, options: ImportOptions): Promise<ImportResult> {
    const rows = parse(csvText, {
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    if (!rows.length) throw ApiError.badRequest("CSV file is empty");
    if (!("email" in rows[0])) throw ApiError.badRequest("CSV must have an 'email' column");

    const template = options.templateId
      ? await prisma.template.findFirst({ where: { id: options.templateId, tenantId } })
      : null;
    if (options.templateId && !template) throw ApiError.notFound("Template not found");

    const result: ImportResult = { total: rows.length, imported: 0, emailed: 0, errors: [] };

    for (const row of rows) {
      const email = row.email?.toLowerCase().trim();
      if (!email) continue;

      let attribs: Record<string, unknown> = {};
      if (row.attributes) {
        try {
          attribs = JSON.parse(row.attributes);
        } catch {
          result.errors.push(`${email}: invalid attributes JSON, skipped`);
        }
      }

      const name = row.name?.trim() || email.split("@")[0];

      const subscriber = await prisma.subscriber.upsert({
        where: { tenantId_email: { tenantId, email } },
        create: {
          tenantId,
          email,
          name,
          attribs: attribs as Prisma.InputJsonValue,
          status: options.mode === "blocklist" ? "blocklisted" : "enabled",
        },
        update:
          options.mode === "blocklist"
            ? { status: "blocklisted" }
            : { name, attribs: Object.keys(attribs).length ? (attribs as Prisma.InputJsonValue) : undefined },
      });

      if (options.mode === "blocklist") {
        await prisma.subscriberList.updateMany({
          where: { subscriberId: subscriber.id },
          data: { status: "unsubscribed" },
        });
      } else {
        for (const listId of options.listIds) {
          await prisma.subscriberList.upsert({
            where: { subscriberId_listId: { subscriberId: subscriber.id, listId } },
            create: { subscriberId: subscriber.id, listId, status: "unconfirmed" },
            update: {},
          });
        }

        if (template) {
          try {
            const data = { Subscriber: subscriber, Tx: { Data: {} } };
            await sendMail({
              to: subscriber.email,
              subject: renderTemplate(template.subject ?? "", data),
              html: renderTemplate(template.body, data),
            });
            result.emailed += 1;
          } catch (err) {
            result.errors.push(`${email}: template send failed (${(err as Error).message})`);
          }
        }
      }

      result.imported += 1;
    }

    return result;
  },
};
