import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requirePlatformAuth } from "./platform.middleware";
import { loginRateLimit } from "../../common/middleware/rateLimit";
import { platformController } from "./platform.controller";

// Deliberately mounted outside the tenant-resolution pipeline (see app.ts) —
// a platform admin manages tenants, they aren't a member of one.
export const platformRouter = Router();

platformRouter.post("/login", loginRateLimit, asyncHandler(platformController.login));
platformRouter.post("/logout", requirePlatformAuth, asyncHandler(platformController.logout));
platformRouter.get("/me", requirePlatformAuth, asyncHandler(platformController.me));

platformRouter.get("/tenants", requirePlatformAuth, asyncHandler(platformController.listTenants));
platformRouter.post("/tenants", requirePlatformAuth, asyncHandler(platformController.createTenant));
platformRouter.put("/tenants/:id/status", requirePlatformAuth, asyncHandler(platformController.setStatus));
platformRouter.post("/tenants/:id/hostnames", requirePlatformAuth, asyncHandler(platformController.addHostname));
platformRouter.delete("/tenants/hostnames/:hostnameId", requirePlatformAuth, asyncHandler(platformController.removeHostname));

platformRouter.get("/settings", requirePlatformAuth, asyncHandler(platformController.getSettings));
platformRouter.put("/settings", requirePlatformAuth, asyncHandler(platformController.updateSettings));
