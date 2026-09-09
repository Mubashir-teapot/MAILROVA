import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { rolesController } from "./roles.controller";

export const rolesRoutes = Router();

rolesRoutes.use(requireAuth, requirePermission("roles:get", "roles:manage"));

rolesRoutes.get("/", asyncHandler(rolesController.list));
rolesRoutes.get("/:id", asyncHandler(rolesController.get));
rolesRoutes.post("/", requirePermission("roles:manage"), asyncHandler(rolesController.create));
rolesRoutes.put("/:id", requirePermission("roles:manage"), asyncHandler(rolesController.update));
rolesRoutes.delete("/:id", requirePermission("roles:manage"), asyncHandler(rolesController.remove));
