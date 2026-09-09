import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { domainsController } from "./domains.controller";

export const domainsRoutes = Router();

domainsRoutes.use(requireAuth, requirePermission("settings:get", "settings:manage"));

domainsRoutes.get("/", asyncHandler(domainsController.list));
domainsRoutes.get("/:id", asyncHandler(domainsController.get));
domainsRoutes.get("/:id/dns-records", asyncHandler(domainsController.dnsRecords));
domainsRoutes.post("/:id/verify", requirePermission("settings:manage"), asyncHandler(domainsController.verify));
domainsRoutes.post("/", requirePermission("settings:manage"), asyncHandler(domainsController.create));
domainsRoutes.put("/:id/warmup", requirePermission("settings:manage"), asyncHandler(domainsController.setWarmup));
domainsRoutes.delete("/:id", requirePermission("settings:manage"), asyncHandler(domainsController.remove));
