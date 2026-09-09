import { prisma } from "../../config/prisma";

const HREF_RE = /href="(https?:\/\/[^"]+)"/g;

// A 1x1 transparent GIF — the classic open-tracking pixel payload.
export const TRACKING_PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7", "base64");

export interface InjectTrackingOptions {
  tenantId: number;
  campaignUuid: string;
  subscriberUuid: string;
  publicUrl: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

// Rewrites every http(s) `href` to a click-tracking redirect (opaque Link
// uuid, not the raw URL, in the query string — avoids trusting/echoing an
// arbitrary URL back from a public unauthenticated endpoint) and appends an
// open-tracking pixel, per the campaign's own toggles. Called once per
// recipient at send time (see campaigns.worker.ts) since the tracking URLs
// are subscriber-specific.
export async function injectTracking(html: string, opts: InjectTrackingOptions): Promise<string> {
  let result = html;

  if (opts.trackClicks) {
    const urls = [...new Set([...html.matchAll(HREF_RE)].map((m) => m[1]))];
    if (urls.length) {
      const links = await Promise.all(
        urls.map((url) =>
          prisma.link.upsert({
            where: { tenantId_url: { tenantId: opts.tenantId, url } },
            create: { tenantId: opts.tenantId, url },
            update: {},
          })
        )
      );
      const linkUuidByUrl = new Map(urls.map((url, i) => [url, links[i].uuid]));
      result = result.replace(HREF_RE, (match, url: string) => {
        const linkUuid = linkUuidByUrl.get(url);
        if (!linkUuid) return match;
        const redirect = `${opts.publicUrl}/api/public/track/click/${linkUuid}?c=${opts.campaignUuid}&s=${opts.subscriberUuid}`;
        return `href="${redirect}"`;
      });
    }
  }

  if (opts.trackOpens) {
    const pixel = `<img src="${opts.publicUrl}/api/public/track/open/${opts.campaignUuid}/${opts.subscriberUuid}" width="1" height="1" alt="" style="display:none" />`;
    result = result.includes("</body>") ? result.replace("</body>", `${pixel}</body>`) : `${result}${pixel}`;
  }

  return result;
}
