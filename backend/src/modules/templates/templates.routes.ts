import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { templatesController } from "./templates.controller";

export const templatesRoutes = Router();

templatesRoutes.use(requireAuth, requirePermission("templates:get", "templates:manage"));

templatesRoutes.get("/", asyncHandler(templatesController.list));
templatesRoutes.get("/:id", asyncHandler(templatesController.get));
templatesRoutes.post("/:id/preview", asyncHandler(templatesController.preview));
templatesRoutes.post("/", requirePermission("templates:manage"), asyncHandler(templatesController.create));
templatesRoutes.put("/:id", requirePermission("templates:manage"), asyncHandler(templatesController.update));
templatesRoutes.delete("/:id", requirePermission("templates:manage"), asyncHandler(templatesController.remove));
