import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requireSuperAdmin } from "../../common/middleware/auth.middleware";
import { usersController } from "./users.controller";

export const usersRoutes = Router();

// Managing accounts is Super Admin only — see requireSuperAdmin's comment
// for why this isn't just another permission a custom role can be granted.
usersRoutes.use(requireAuth, requireSuperAdmin);

usersRoutes.get("/", asyncHandler(usersController.list));
usersRoutes.get("/:id", asyncHandler(usersController.get));
usersRoutes.post("/", asyncHandler(usersController.create));
usersRoutes.put("/:id", asyncHandler(usersController.update));
usersRoutes.delete("/:id", asyncHandler(usersController.remove));
