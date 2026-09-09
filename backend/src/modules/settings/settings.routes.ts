import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { settingsController } from "./settings.controller";

export const settingsRoutes = Router();

settingsRoutes.use(requireAuth, requirePermission("settings:get", "settings:manage"));

settingsRoutes.get("/", asyncHandler(settingsController.get));
settingsRoutes.put("/", requirePermission("settings:manage"), asyncHandler(settingsController.update));
