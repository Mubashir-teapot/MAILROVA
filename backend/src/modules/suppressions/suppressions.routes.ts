import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { suppressionsController } from "./suppressions.controller";

export const suppressionsRoutes = Router();

suppressionsRoutes.use(requireAuth, requirePermission("bounces:get", "bounces:manage"));

suppressionsRoutes.get("/", asyncHandler(suppressionsController.list));
suppressionsRoutes.post("/", requirePermission("bounces:manage"), asyncHandler(suppressionsController.add));
suppressionsRoutes.delete("/:id", requirePermission("bounces:manage"), asyncHandler(suppressionsController.remove));
