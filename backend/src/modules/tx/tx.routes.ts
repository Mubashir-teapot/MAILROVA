import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { txController } from "./tx.controller";

export const txRoutes = Router();

txRoutes.post("/", requireAuth, requirePermission("tx:send"), asyncHandler(txController.send));
