import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { auditLogsController } from "./auditLogs.controller";

export const auditLogsRoutes = Router();

auditLogsRoutes.use(requireAuth, requirePermission("audit:get"));
auditLogsRoutes.get("/", asyncHandler(auditLogsController.list));
