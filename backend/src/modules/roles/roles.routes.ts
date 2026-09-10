import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { rolesController } from "./roles.controller";

export const rolesRoutes = Router();

rolesRoutes.use(requireAuth, requirePermission("roles:get", "roles:manage"));

rolesRoutes.get("/", asyncHandler(rolesController.list));
// Must come before "/:id" — otherwise Express would treat "permissions" as
// an :id value. The catalog of every assignable permission, for the
// create/edit role UI's checkbox picker (single source of truth: the
// frontend never hardcodes this list, so it can't drift from ALL_PERMISSIONS).
rolesRoutes.get("/permissions", asyncHandler(rolesController.permissions));
rolesRoutes.get("/:id", asyncHandler(rolesController.get));
rolesRoutes.post("/", requirePermission("roles:manage"), asyncHandler(rolesController.create));
rolesRoutes.put("/:id", requirePermission("roles:manage"), asyncHandler(rolesController.update));
rolesRoutes.delete("/:id", requirePermission("roles:manage"), asyncHandler(rolesController.remove));
