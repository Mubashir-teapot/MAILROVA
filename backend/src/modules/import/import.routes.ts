import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { importController } from "./import.controller";
import { uploadCsv } from "./import.upload";

export const importRoutes = Router();

importRoutes.post(
  "/subscribers",
  requireAuth,
  requirePermission("subscribers:import"),
  uploadCsv.single("file"),
  asyncHandler(importController.importSubscribers)
);
