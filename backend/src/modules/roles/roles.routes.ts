import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requireSuperAdmin } from "../../common/middleware/auth.middleware";
import { rolesController } from "./roles.controller";

export const rolesRoutes = Router();

// Defining what permissions exist is Super Admin only — see
// requireSuperAdmin's comment for why this isn't just another permission a
// custom role can be granted.
rolesRoutes.use(requireAuth, requireSuperAdmin);

rolesRoutes.get("/", asyncHandler(rolesController.list));
// Must come before "/:id" — otherwise Express would treat "permissions" as
// an :id value. The catalog of every assignable permission, for the
// create/edit role UI's checkbox picker (single source of truth: the
// frontend never hardcodes this list, so it can't drift from ALL_PERMISSIONS).
rolesRoutes.get("/permissions", asyncHandler(rolesController.permissions));
rolesRoutes.get("/:id", asyncHandler(rolesController.get));
rolesRoutes.post("/", asyncHandler(rolesController.create));
rolesRoutes.put("/:id", asyncHandler(rolesController.update));
rolesRoutes.delete("/:id", asyncHandler(rolesController.remove));
