import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock() factories are hoisted above the whole file, including any plain
// `const` above them — vi.hoisted() is what lets the factory reference
// these without a "used before initialization" error.
const { resolveTxt, resolveMx, resolve4, reverse, readDkimPublicKeyRecord } = vi.hoisted(() => ({
  resolveTxt: vi.fn(),
  resolveMx: vi.fn(),
  resolve4: vi.fn(),
  reverse: vi.fn(),
  readDkimPublicKeyRecord: vi.fn(),
}));

vi.mock("dns/promises", () => ({
  default: { resolveTxt, resolveMx, resolve4, reverse },
}));

vi.mock("../src/common/docker/dockerService", () => ({
  readDkimPublicKeyRecord,
  syncMtaDomains: vi.fn(),
}));

// Imported after the mocks above so dnsVerify.ts picks up the mocked
// modules — vi.mock is hoisted, but the import still has to come after for
// the const references (resolveTxt etc.) to already be in scope.
const { verifyDomainDns, verifyPtr } = await import("../src/modules/domains/dnsVerify");
const { env } = await import("../src/config/env");

describe("dnsVerify", () => {
  beforeEach(() => {
    resolveTxt.mockReset();
    resolveMx.mockReset();
    resolve4.mockReset();
    reverse.mockReset();
    readDkimPublicKeyRecord.mockReset();
  });

  describe("verifyDomainDns", () => {
    const domain = { domain: "example.com", dkimSelector: "mail" };

    it("marks SPF verified when the TXT record contains the server IP", async () => {
      resolveTxt.mockImplementation(async (name: string) =>
        name === domain.domain ? [[`v=spf1 ip4:${env.mta.serverIp} ~all`]] : Promise.reject(new Error("NXDOMAIN"))
      );
      resolveMx.mockResolvedValue([]);
      readDkimPublicKeyRecord.mockResolvedValue(null);

      const result = await verifyDomainDns(domain);
      expect(result.spfStatus).toBe("verified");
    });

    it("marks SPF failed when the TXT record doesn't mention the server IP", async () => {
      resolveTxt.mockResolvedValue([["v=spf1 ip4:198.51.100.1 ~all"]]);
      resolveMx.mockResolvedValue([]);
      readDkimPublicKeyRecord.mockResolvedValue(null);

      const result = await verifyDomainDns(domain);
      expect(result.spfStatus).toBe("failed");
    });

    it("marks DKIM verified when the published TXT key matches what OpenDKIM generated", async () => {
      readDkimPublicKeyRecord.mockResolvedValue('mail._domainkey IN TXT ( "v=DKIM1; k=rsa; " "p=ABCD1234" )');
      resolveTxt.mockImplementation(async (name: string) => {
        if (name === `${domain.dkimSelector}._domainkey.${domain.domain}`) return [["v=DKIM1; k=rsa; p=ABCD1234"]];
        return Promise.reject(new Error("NXDOMAIN"));
      });
      resolveMx.mockResolvedValue([]);

      const result = await verifyDomainDns(domain);
      expect(result.dkimStatus).toBe("verified");
    });

    it("marks DKIM failed when the DKIM key hasn't been generated yet", async () => {
      readDkimPublicKeyRecord.mockResolvedValue(null);
      resolveTxt.mockResolvedValue([]);
      resolveMx.mockResolvedValue([]);

      const result = await verifyDomainDns(domain);
      expect(result.dkimStatus).toBe("failed");
    });

    it("marks DMARC verified when _dmarc TXT contains v=DMARC1", async () => {
      readDkimPublicKeyRecord.mockResolvedValue(null);
      resolveTxt.mockImplementation(async (name: string) =>
        name === `_dmarc.${domain.domain}` ? [["v=DMARC1; p=quarantine;"]] : Promise.reject(new Error("NXDOMAIN"))
      );
      resolveMx.mockResolvedValue([]);

      const result = await verifyDomainDns(domain);
      expect(result.dmarcStatus).toBe("verified");
    });

    it("marks MX verified only when the configured MTA hostname is among the resolved exchanges", async () => {
      readDkimPublicKeyRecord.mockResolvedValue(null);
      resolveTxt.mockResolvedValue([]);
      resolveMx.mockResolvedValue([{ exchange: env.mta.hostname, priority: 10 }]);

      const result = await verifyDomainDns(domain);
      expect(result.mxStatus).toBe("verified");
    });

    it("marks MX failed when resolveMx throws (no MX record at all)", async () => {
      readDkimPublicKeyRecord.mockResolvedValue(null);
      resolveTxt.mockResolvedValue([]);
      resolveMx.mockRejectedValue(new Error("NXDOMAIN"));

      const result = await verifyDomainDns(domain);
      expect(result.mxStatus).toBe("failed");
    });
  });

  describe("verifyPtr", () => {
    it("is pending when no server IP is configured", async () => {
      const result = await verifyPtr(undefined);
      expect(result.status).toBe("pending");
    });

    it("is verified when the PTR hostname's own A record forward-confirms back to the same IP", async () => {
      reverse.mockResolvedValue(["mail.example.com"]);
      resolve4.mockResolvedValue(["203.0.113.10"]);

      const result = await verifyPtr("203.0.113.10");
      expect(result.status).toBe("verified");
      expect(result.ptrHostname).toBe("mail.example.com");
    });

    it("is failed when the PTR hostname's A record does not match (not forward-confirmed)", async () => {
      reverse.mockResolvedValue(["mail.example.com"]);
      resolve4.mockResolvedValue(["198.51.100.99"]);

      const result = await verifyPtr("203.0.113.10");
      expect(result.status).toBe("failed");
    });

    it("is failed when there is no PTR record at all", async () => {
      reverse.mockRejectedValue(new Error("NXDOMAIN"));

      const result = await verifyPtr("203.0.113.10");
      expect(result.status).toBe("failed");
      expect(result.ptrHostname).toBeNull();
    });
  });
});
