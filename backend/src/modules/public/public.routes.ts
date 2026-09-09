import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { publicRateLimit } from "../../common/middleware/rateLimit";
import { publicController } from "./public.controller";

export const publicRoutes = Router();

publicRoutes.use(publicRateLimit);

publicRoutes.get("/lists", asyncHandler(publicController.lists));
publicRoutes.post("/subscription", asyncHandler(publicController.subscribe));
publicRoutes.post("/optin/:subscriberUuid", asyncHandler(publicController.confirmOptin));
publicRoutes.post("/unsubscribe/:subscriberUuid", asyncHandler(publicController.unsubscribe));

// The link embedded in every campaign's List-Unsubscribe header/footer —
// token-authenticated (see unsubscribeToken.ts), no login needed. GET so a
// plain clicked link works; POST too for RFC 8058 one-click clients.
publicRoutes.get("/unsubscribe-link", asyncHandler(publicController.unsubscribeByLink));
publicRoutes.post("/unsubscribe-link", asyncHandler(publicController.unsubscribeByLink));
