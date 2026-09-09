import { app } from "./app";
import { env } from "./config/env";
import { startCampaignScheduler } from "./modules/campaigns/campaigns.scheduler";

app.listen(env.port, () => {
  console.log(`Mailrova backend listening on :${env.port} [${env.nodeEnv}]`);
});

startCampaignScheduler(env.campaignSchedulerIntervalMs);
