import { app } from "./app";
import { env } from "./config/env";
import { startQueue } from "./common/queue/boss";
import { startCampaignWorker } from "./modules/campaigns/campaigns.worker";
import { startCampaignScheduler } from "./modules/campaigns/campaigns.scheduler";
import { domainsRepository } from "./modules/domains/domains.repository";
import { syncMtaDomains } from "./common/docker/dockerService";

app.listen(env.port, () => {
  console.log(`Mailrova backend listening on :${env.port} [${env.nodeEnv}]`);
});

// mta's OpenDKIM config (KeyTable/SigningTable) lives on the container's own
// ephemeral filesystem, not a persistent volume — a full redeploy recreates
// mta from a clean image with none of it, even though the actual DKIM key
// files survive (those ARE on a volume). Domain sync only otherwise runs
// when a domain is explicitly added/removed, so without this, every
// redeploy silently breaks DKIM signing for every existing domain until
// someone happens to touch one. Runs once per backend boot to reconcile.
domainsRepository
  .listNames()
  .then((names) => (names.length ? syncMtaDomains(names) : undefined))
  .catch((err) => console.error("failed to sync mta domains on startup:", err));

startQueue()
  .then(startCampaignWorker)
  .then(() => startCampaignScheduler(env.campaignSchedulerIntervalMs))
  .catch((err) => {
    console.error("failed to start the send queue:", err);
    process.exit(1);
  });
