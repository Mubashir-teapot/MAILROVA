import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { apiKeysController } from "./apiKeys.controller";

export const apiKeysRoutes = Router();

apiKeysRoutes.use(requireAuth, requirePermission("api_keys:manage"));

apiKeysRoutes.get("/", asyncHandler(apiKeysController.list));
apiKeysRoutes.post("/", asyncHandler(apiKeysController.create));
apiKeysRoutes.delete("/:id", asyncHandler(apiKeysController.revoke));
