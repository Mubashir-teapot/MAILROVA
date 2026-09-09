import { ApiError } from "../../common/utils/ApiError";
import { sendMail } from "../../common/mail/mailer";
import { renderTemplate } from "../../common/utils/renderTemplate";
import { prisma } from "../../config/prisma";

export interface TxInput {
  templateId: number;
  subscriberEmail?: string;
  subscriberId?: number;
  subject?: string;
  fromEmail?: string;
  data?: Record<string, unknown>;
}

export const txService = {
  async send(tenantId: number, input: TxInput) {
    const template = await prisma.template.findFirst({ where: { id: input.templateId, tenantId } });
    if (!template || template.type !== "tx") throw ApiError.notFound("Transactional template not found");

    const subscriber = input.subscriberId
      ? await prisma.subscriber.findFirst({ where: { id: input.subscriberId, tenantId } })
      : input.subscriberEmail
      ? await prisma.subscriber.findUnique({ where: { tenantId_email: { tenantId, email: input.subscriberEmail.toLowerCase() } } })
      : null;

    // `fallback` semantics (FEATURES.md §7): send anyway even if not a known subscriber.
    const recipientEmail = subscriber?.email ?? input.subscriberEmail;
    if (!recipientEmail) throw ApiError.badRequest("subscriberEmail or a known subscriberId is required");

    const suppressed = await prisma.suppression.findUnique({
      where: { tenantId_email: { tenantId, email: recipientEmail.toLowerCase() } },
    });
    if (suppressed) throw ApiError.badRequest("This address is on the suppression list");

    const renderData = { Subscriber: subscriber ?? { email: recipientEmail }, Tx: { Data: input.data ?? {} } };

    await sendMail({
      to: recipientEmail,
      from: input.fromEmail,
      subject: renderTemplate(input.subject ?? template.subject ?? "", renderData),
      html: renderTemplate(template.body, renderData),
    });

    return true;
  },
};
