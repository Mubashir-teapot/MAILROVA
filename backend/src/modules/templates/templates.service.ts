import { Prisma } from "@prisma/client";
import { ApiError } from "../../common/utils/ApiError";
import { renderTemplate } from "../../common/utils/renderTemplate";
import { sendMail } from "../../common/mail/mailer";
import { templatesRepository } from "./templates.repository";

export interface TemplateInput {
  name: string;
  type?: "campaign" | "campaign_visual" | "tx";
  subject?: string;
  body: string;
  // The block-editor's JSON document, for type "campaign_visual" — `body` is
  // the compiled HTML (what's actually sent), this is what re-opens in the
  // visual builder for editing.
  bodySource?: unknown;
  isDefault?: boolean;
}

export const templatesService = {
  list(tenantId: number) {
    return templatesRepository.findAll(tenantId);
  },

  async get(tenantId: number, id: number) {
    const tpl = await templatesRepository.findById(tenantId, id);
    if (!tpl) throw ApiError.notFound("Template not found");
    return tpl;
  },

  async create(tenantId: number, input: TemplateInput) {
    if (input.type === "tx" && !input.subject) {
      throw ApiError.badRequest("Transactional templates require a subject");
    }
    if (input.isDefault) await templatesRepository.clearDefault(tenantId);
    return templatesRepository.create({
      tenant: { connect: { id: tenantId } },
      name: input.name,
      type: input.type ?? "campaign",
      subject: input.subject,
      body: input.body,
      bodySource: input.bodySource as Prisma.InputJsonValue | undefined,
      isDefault: input.isDefault ?? false,
    });
  },

  async update(tenantId: number, id: number, input: Partial<TemplateInput>) {
    await templatesService.get(tenantId, id);
    if (input.isDefault) await templatesRepository.clearDefault(tenantId);
    return templatesRepository.update(tenantId, id, {
      ...input,
      bodySource: input.bodySource as Prisma.InputJsonValue | undefined,
    });
  },

  async remove(tenantId: number, id: number) {
    const tpl = await templatesService.get(tenantId, id);
    if (tpl.isDefault) throw ApiError.forbidden("Cannot delete the default template");
    if ((await templatesRepository.countAll(tenantId)) <= 1) {
      throw ApiError.forbidden("Cannot delete the last remaining template");
    }
    await templatesRepository.remove(tenantId, id);
  },

  async preview(tenantId: number, id: number, sampleData: Record<string, unknown>) {
    const tpl = await templatesService.get(tenantId, id);
    return { subject: tpl.subject ? renderTemplate(tpl.subject, sampleData) : undefined, body: renderTemplate(tpl.body, sampleData) };
  },

  // Bypasses suppression/caps entirely — this is an explicit, one-off test
  // send the admin asked for, not a real campaign/tx recipient.
  async sendTest(tenantId: number, id: number, toEmail: string) {
    const tpl = await templatesService.get(tenantId, id);
    const sampleData = {
      Subscriber: { email: toEmail, name: "Preview" },
      Campaign: { name: tpl.name, subject: tpl.subject ?? "" },
      UnsubscribeUrl: "#",
    };
    await sendMail({
      to: toEmail,
      subject: `[TEST] ${tpl.subject ? renderTemplate(tpl.subject, sampleData) : tpl.name}`,
      html: renderTemplate(tpl.body, sampleData),
    });
  },
};
