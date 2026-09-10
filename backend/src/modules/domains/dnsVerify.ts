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

export interface PtrCheckResult {
  status: DnsCheckStatus;
  ptrHostname: string | null;
  note: string;
}

// PTR/reverse-DNS is a property of the server's IP, set by the hosting
// provider at the network level — not something a DNS zone record or a
// "Verify"/"Fix" button here can change, unlike SPF/DKIM/DMARC/MX above.
// Forward-confirms the PTR hostname's own A record resolves back to the
// same IP (FCrDNS) — what most receiving mail servers actually check, not
// just that a PTR exists at all.
export async function verifyPtr(serverIp: string | undefined): Promise<PtrCheckResult> {
  if (!serverIp) {
    return { status: "pending", ptrHostname: null, note: "Set SERVER_PUBLIC_IP in .env to check this." };
  }

  let ptrHostname: string | null;
  try {
    const hostnames = await dns.reverse(serverIp);
    ptrHostname = hostnames[0] ?? null;
  } catch {
    ptrHostname = null;
  }
  if (!ptrHostname) {
    return { status: "failed", ptrHostname: null, note: `No PTR record found for ${serverIp}. Ask your hosting provider to set one.` };
  }

  try {
    const forward = await dns.resolve4(ptrHostname);
    if (!forward.includes(serverIp)) {
      return {
        status: "failed",
        ptrHostname,
        note: `PTR points to "${ptrHostname}", but that hostname's A record doesn't resolve back to ${serverIp} (not forward-confirmed).`,
      };
    }
  } catch {
    return { status: "failed", ptrHostname, note: `PTR points to "${ptrHostname}", but it has no A record to forward-confirm against.` };
  }

  return { status: "verified", ptrHostname, note: "Forward-confirmed reverse DNS looks correct." };
}
