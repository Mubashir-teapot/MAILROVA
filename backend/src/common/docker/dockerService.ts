import Docker from "dockerode";
import { env } from "../../config/env";

// Talks to `docker-proxy` (tecnativa/docker-socket-proxy, see
// docker-compose.yml), not the raw socket — it only forwards the container
// inspect/create/start/stop/remove calls this file actually makes, so a
// compromised backend can't reach images/volumes/networks/exec/secrets/swarm
// or any container other than what it already targets by name.
const docker = new Docker({ host: "docker-proxy", port: 2375 });

function setEnvVar(envList: string[], key: string, value: string): string[] {
  const idx = envList.findIndex((e) => e.startsWith(`${key}=`));
  const entry = `${key}=${value}`;
  if (idx === -1) return [...envList, entry];
  const next = [...envList];
  next[idx] = entry;
  return next;
}

// Recreates the mta container so OpenDKIM picks up a new/changed domain list
// and generates keys for it. Preserves the container's image, volumes,
// network attachment, and restart policy — only the env vars change.
export async function syncMtaDomains(domains: string[]): Promise<void> {
  const name = env.mta.containerName;
  const container = docker.getContainer(name);

  const info = await container.inspect();
  const nextEnv = setEnvVar(
    setEnvVar(info.Config.Env ?? [], "ALLOWED_SENDER_DOMAINS", domains.join(" ")),
    "DKIM_AUTOGENERATE",
    "1"
  );

  try {
    await container.stop();
  } catch {
    // already stopped — fine
  }
  await container.remove();

  const created = await docker.createContainer({
    name,
    Image: info.Config.Image,
    Env: nextEnv,
    Hostname: info.Config.Hostname,
    ExposedPorts: info.Config.ExposedPorts,
    HostConfig: info.HostConfig,
    NetworkingConfig: { EndpointsConfig: info.NetworkSettings.Networks },
  });

  await created.start();
}

// Reads the DKIM public key OpenDKIM generated for a domain, from the shared
// volume also mounted (read-only) into the backend container.
export async function readDkimPublicKeyRecord(domain: string, selector: string): Promise<string | null> {
  const fs = await import("fs/promises");
  const path = `${env.mta.dkimKeysPath}/${domain}/${selector}.txt`;
  try {
    const raw = await fs.readFile(path, "utf-8");
    // The .txt file boky/postfix writes is BIND zone-file format, e.g.:
    //   mail._domainkey IN TXT ( "v=DKIM1; k=rsa; " "p=MIGfMA0...IDAQAB" )
    // Extract and concatenate the quoted segments into one TXT value.
    const parts = [...raw.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    return parts.length ? parts.join("") : raw.trim();
  } catch {
    return null; // not generated yet — container hasn't finished (re)starting
  }
}
