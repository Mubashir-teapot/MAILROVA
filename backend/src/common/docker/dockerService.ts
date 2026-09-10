import Docker from "dockerode";
import { env } from "../../config/env";

// Talks to `docker-proxy` (tecnativa/docker-socket-proxy, see
// docker-compose.yml), not the raw socket — it only forwards the container
// inspect/exec calls this file actually makes, so a compromised backend
// can't reach images/volumes/networks/other containers, swarm, secrets, or
// container lifecycle management (no CREATE/DELETE needed — see below).
const docker = new Docker({ host: "docker-proxy", port: 2375 });

// Runs a command inside the already-running mta container and waits for it
// to finish, throwing if it exits non-zero. Uses `docker exec` rather than
// mounting a script file — this is a handful of lines run maybe once a
// minute, not worth a shared volume just to avoid an inline heredoc.
async function execInMta(cmd: string[], envVars: string[]): Promise<void> {
  const container = docker.getContainer(env.mta.containerName);
  const exec = await container.exec({ Cmd: cmd, Env: envVars, AttachStdout: true, AttachStderr: true });
  const stream = await exec.start({ Tty: false });

  const chunks: Buffer[] = [];
  const collect = { write: (chunk: Buffer) => void chunks.push(chunk) };
  await new Promise<void>((resolve, reject) => {
    docker.modem.demuxStream(stream, collect as unknown as NodeJS.WritableStream, collect as unknown as NodeJS.WritableStream);
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  const { ExitCode } = await exec.inspect();
  if (ExitCode !== 0) {
    throw new Error(`mta exec failed (exit ${ExitCode}): ${Buffer.concat(chunks).toString("utf-8")}`);
  }
}

// Callers (domains.service.ts's create/remove) fire this in the background,
// not awaited — two domain operations in quick succession (e.g. delete then
// re-add) would otherwise race writing the same KeyTable/SigningTable
// files. Chaining every call onto this queue forces them to run one at a
// time, in order, so the last call queued is always the last one applied.
let queue: Promise<void> = Promise.resolve();

export function syncMtaDomains(domains: string[]): Promise<void> {
  const task = queue.then(() => doSyncMtaDomains(domains));
  // Swallow here so one failed sync doesn't permanently jam the queue for
  // every sync after it — the real error still reaches this call's own
  // caller via `task`, which is returned below untouched.
  queue = task.catch(() => undefined);
  return task;
}

// Generates any missing domain's DKIM key and rewrites OpenDKIM's
// KeyTable/SigningTable to match the given domain list, then restarts just
// the opendkim process (via the container's own supervisord) to pick it up.
//
// This used to stop/remove/recreate the whole mta container instead — which
// needed Docker lifecycle permissions on docker-proxy (CREATE/DELETE),
// raced when two domain changes happened close together, and interrupted
// mail delivery for every OTHER domain's queue for the several seconds a
// full container recreation takes. None of that is necessary: OpenDKIM's
// config is just three text files it can be told to re-read, so this talks
// to the container that's already running instead. Mirrors exactly what
// boky/postfix's own startup does (image_root/scripts/functions.sh's
// opendkim_setup_dkim(), confirmed against its source) — same
// opendkim-genkey flags, same sed fixup of the txt record's h= tag, same
// file ownership/permissions — just invoked via `docker exec` for one
// domain at a time instead of a full boot re-running it for all of them.
async function doSyncMtaDomains(domains: string[]): Promise<void> {
  const script = `
set -e
mkdir -p /etc/opendkim/keys
for domain in $DOMAINS; do
  if [ ! -f "/etc/opendkim/keys/$domain.private" ]; then
    cd /tmp
    opendkim-genkey -b 2048 -h rsa-sha256 -r -v --subdomains -s "$SELECTOR" -d "$domain"
    sed -i 's/h=rsa-sha256/h=sha256/' "$SELECTOR.txt"
    mv "$SELECTOR.private" "/etc/opendkim/keys/$domain.private"
    mv "$SELECTOR.txt" "/etc/opendkim/keys/$domain.txt"
    chown opendkim:opendkim "/etc/opendkim/keys/$domain.private" "/etc/opendkim/keys/$domain.txt"
    chmod 400 "/etc/opendkim/keys/$domain.private"
    chmod 644 "/etc/opendkim/keys/$domain.txt"
  fi
done
: > /etc/opendkim/KeyTable
: > /etc/opendkim/SigningTable
for domain in $DOMAINS; do
  echo "$SELECTOR._domainkey.$domain $domain:$SELECTOR:/etc/opendkim/keys/$domain.private" >> /etc/opendkim/KeyTable
  echo "*@$domain $SELECTOR._domainkey.$domain" >> /etc/opendkim/SigningTable
done
supervisorctl restart opendkim
`.trim();

  await execInMta(["sh", "-c", script], [`DOMAINS=${domains.join(" ")}`, `SELECTOR=${env.mta.dkimSelector}`]);
}

// Reads the DKIM public key OpenDKIM generated for a domain, from the shared
// volume also mounted (read-only) into the backend container. boky/postfix's
// DKIM_AUTOGENERATE writes these flat — "{domain}.private"/"{domain}.txt" —
// not nested under a per-domain folder or named after the selector (confirmed
// against this image's own startup log: "Key for domain x.com already exists
// in /etc/opendkim/keys/x.com.private"). `selector` is unused here — it only
// matters for the DNS record *name* (${selector}._domainkey.${domain}),
// constructed separately in domains.service.ts — but stays in the signature
// since every call site already has it at hand and passing it costs nothing.
export async function readDkimPublicKeyRecord(domain: string, _selector: string): Promise<string | null> {
  const fs = await import("fs/promises");
  const path = `${env.mta.dkimKeysPath}/${domain}.txt`;
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
