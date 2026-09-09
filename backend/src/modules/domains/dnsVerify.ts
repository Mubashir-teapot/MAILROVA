import dns from "dns/promises";
import { DnsCheckStatus } from "@prisma/client";
import { env } from "../../config/env";
import { readDkimPublicKeyRecord } from "../../common/docker/dockerService";

async function txtContains(name: string, needle: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(name);
    return records.some((parts) => parts.join("").includes(needle));
  } catch {
    return false; // NXDOMAIN or no TXT records at all — not verified.
  }
}

// Live DNS lookups against what the domain was told to configure — this is
// what powers the "Verify DNS" button, turning each record from `pending`
// into `verified`/`failed` instead of just trusting the admin added it.
export async function verifyDomainDns(domain: {
  domain: string;
  dkimSelector: string;
}): Promise<{
  spfStatus: DnsCheckStatus;
  dkimStatus: DnsCheckStatus;
  dmarcStatus: DnsCheckStatus;
  mxStatus: DnsCheckStatus;
}> {
  const [spfOk, dkimOk, dmarcOk, mxOk] = await Promise.all([
    env.mta.serverIp ? txtContains(domain.domain, env.mta.serverIp) : Promise.resolve(false),
    verifyDkim(domain.domain, domain.dkimSelector),
    txtContains(`_dmarc.${domain.domain}`, "v=DMARC1"),
    verifyMx(domain.domain),
  ]);

  return {
    spfStatus: spfOk ? "verified" : "failed",
    dkimStatus: dkimOk ? "verified" : "failed",
    dmarcStatus: dmarcOk ? "verified" : "failed",
    mxStatus: mxOk ? "verified" : "failed",
  };
}

async function verifyDkim(domain: string, selector: string): Promise<boolean> {
  const expected = await readDkimPublicKeyRecord(domain, selector);
  if (!expected) return false; // key hasn't even been generated yet
  // Compare just the public-key portion — full-record string comparison is
  // brittle against formatting/whitespace differences from copy-pasting.
  const expectedKey = expected.match(/p=([A-Za-z0-9+/=]+)/)?.[1];
  if (!expectedKey) return false;
  return txtContains(`${selector}._domainkey.${domain}`, expectedKey);
}

async function verifyMx(domain: string): Promise<boolean> {
  if (!env.mta.hostname) return false; // inbound MX isn't configured for this deployment
  try {
    const records = await dns.resolveMx(domain);
    return records.some((r) => r.exchange.toLowerCase() === env.mta.hostname!.toLowerCase());
  } catch {
    return false;
  }
}
