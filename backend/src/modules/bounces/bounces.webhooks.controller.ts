import { Request, Response } from "express";
import { ApiError } from "../../common/utils/ApiError";
import { env } from "../../config/env";
import { bouncesService } from "./bounces.service";

function findHeaderValue(headers: { name: string; value: string }[] | undefined, name: string) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

export const bounceWebhooksController = {
  // Amazon SES delivered via SNS. Handles both the subscription handshake and
  // the actual bounce/complaint notifications.
  // ponytail: no SNS message-signature verification — fine behind a secret
  // path/proxy for now, add cert verification before exposing this publicly.
  async ses(req: Request, res: Response) {
    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as {
      Type: string;
      SubscribeURL?: string;
      Message?: string;
    };

    if (body.Type === "SubscriptionConfirmation" && body.SubscribeURL) {
      await fetch(body.SubscribeURL).catch(() => undefined);
      res.status(200).send("subscribed");
      return;
    }

    if (body.Type !== "Notification" || !body.Message) {
      res.status(200).send("ignored");
      return;
    }

    const msg = JSON.parse(body.Message) as {
      notificationType: "Bounce" | "Complaint" | string;
      bounce?: { bounceType: string; bouncedRecipients: { emailAddress: string }[] };
      complaint?: { complainedRecipients: { emailAddress: string }[] };
      mail?: { headers?: { name: string; value: string }[] };
    };

    const campaignUuid = findHeaderValue(msg.mail?.headers, "X-Campaign-UUID");

    if (msg.notificationType === "Bounce" && msg.bounce) {
      const type = msg.bounce.bounceType === "Permanent" ? "hard" : "soft";
      for (const r of msg.bounce.bouncedRecipients) {
        await bouncesService.record({ email: r.emailAddress, type, source: "ses", campaignUuid, meta: msg });
      }
    } else if (msg.notificationType === "Complaint" && msg.complaint) {
      for (const r of msg.complaint.complainedRecipients) {
        await bouncesService.record({ email: r.emailAddress, type: "complaint", source: "ses", campaignUuid, meta: msg });
      }
    }

    res.status(200).send("ok");
  },

  // SendGrid Event Webhook — an array of events; only bounce/spam-report kept.
  // Gated by a shared secret in the query string since we don't verify SendGrid's
  // ECDSA payload signature here (see FEATURES.md §10 for the real thing).
  async sendgrid(req: Request, res: Response) {
    requireWebhookKey(req);

    const events = req.body as { event: string; email: string; type?: string; sg_message_id?: string }[];
    for (const e of events) {
      if (e.event === "bounce") {
        const type = e.type === "blocked" || e.type === "bounced" ? "hard" : "soft";
        await bouncesService.record({ email: e.email, type, source: "sendgrid", meta: e });
      } else if (e.event === "spamreport") {
        await bouncesService.record({ email: e.email, type: "complaint", source: "sendgrid", meta: e });
      }
    }

    res.status(200).send("ok");
  },

  // Postmark webhook — HTTP Basic Auth.
  // ponytail: campaign correlation via Metadata only works if you send through
  // Postmark's own API with that metadata attached — plain SMTP relay (what
  // this scaffold's mailer does) won't populate it. Matching by e-mail still
  // works either way, which is what actually drives the blocklist/unsubscribe
  // action.
  async postmark(req: Request, res: Response) {
    requireBasicAuth(req, env.bounce.postmarkUser, env.bounce.postmarkPass);

    const body = req.body as {
      RecordType: string;
      Type?: string;
      Email: string;
      Metadata?: Record<string, string>;
    };

    if (body.RecordType === "SpamComplaint") {
      await bouncesService.record({ email: body.Email, type: "complaint", source: "postmark", meta: body });
    } else if (body.RecordType === "Bounce") {
      const hard = ["HardBounce", "BadEmailAddress", "ManuallyDeactivated"].includes(body.Type ?? "");
      await bouncesService.record({
        email: body.Email,
        type: hard ? "hard" : "soft",
        source: "postmark",
        campaignUuid: body.Metadata?.["X-Campaign-UUID"],
        meta: body,
      });
    }

    res.status(200).send("ok");
  },
};

function requireWebhookKey(req: Request) {
  if (!env.bounce.webhookKey) throw ApiError.forbidden("Bounce webhook not configured");
  if (req.query.key !== env.bounce.webhookKey) throw ApiError.unauthorized("Invalid webhook key");
}

function requireBasicAuth(req: Request, user?: string, pass?: string) {
  if (!user || !pass) throw ApiError.forbidden("Bounce webhook not configured");
  const header = req.headers.authorization;
  if (!header?.startsWith("Basic ")) throw ApiError.unauthorized();
  const [u, p] = Buffer.from(header.slice(6), "base64").toString().split(":");
  if (u !== user || p !== pass) throw ApiError.unauthorized();
}
