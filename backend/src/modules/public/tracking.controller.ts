import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { TRACKING_PIXEL_GIF } from "../../common/utils/trackingRewrite";

export const trackingController = {
  // Always returns the pixel, even for an unknown campaign/subscriber —
  // this is embedded in an email image tag, a broken image would be visibly
  // wrong to the recipient for no benefit.
  async open(req: Request, res: Response) {
    const { campaignUuid, subscriberUuid } = req.params;
    const campaign = await prisma.campaign.findUnique({ where: { uuid: campaignUuid }, select: { id: true } });
    if (campaign) {
      const subscriber = await prisma.subscriber.findUnique({ where: { uuid: subscriberUuid }, select: { id: true } });
      await prisma.campaignView.create({ data: { campaignId: campaign.id, subscriberId: subscriber?.id } }).catch(() => undefined);
    }
    res.set("Content-Type", "image/gif");
    res.set("Cache-Control", "no-store");
    res.send(TRACKING_PIXEL_GIF);
  },

  async click(req: Request, res: Response) {
    const link = await prisma.link.findUnique({ where: { uuid: req.params.linkUuid } });
    if (!link) {
      res.status(404).send("Not found");
      return;
    }

    const campaignUuid = typeof req.query.c === "string" ? req.query.c : undefined;
    const subscriberUuid = typeof req.query.s === "string" ? req.query.s : undefined;
    const campaign = campaignUuid ? await prisma.campaign.findUnique({ where: { uuid: campaignUuid }, select: { id: true } }) : null;
    if (campaign) {
      const subscriber = subscriberUuid
        ? await prisma.subscriber.findUnique({ where: { uuid: subscriberUuid }, select: { id: true } })
        : null;
      await prisma.linkClick
        .create({ data: { linkId: link.id, campaignId: campaign.id, subscriberId: subscriber?.id } })
        .catch(() => undefined);
    }

    res.redirect(302, link.url);
  },
};
