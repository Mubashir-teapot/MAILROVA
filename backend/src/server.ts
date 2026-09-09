import { app } from "./app";
import { env } from "./config/env";
import { startQueue } from "./common/queue/boss";
import { startCampaignWorker } from "./modules/campaigns/campaigns.worker";
import { startCampaignScheduler } from "./modules/campaigns/campaigns.scheduler";

app.listen(env.port, () => {
  console.log(`Mailrova backend listening on :${env.port} [${env.nodeEnv}]`);
});

startQueue()
  .then(startCampaignWorker)
  .then(() => startCampaignScheduler(env.campaignSchedulerIntervalMs))
  .catch((err) => {
    console.error("failed to start the send queue:", err);
    process.exit(1);
  });
