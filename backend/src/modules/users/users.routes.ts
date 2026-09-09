import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { usersController } from "./users.controller";

export const usersRoutes = Router();

usersRoutes.use(requireAuth, requirePermission("users:get", "users:manage"));

usersRoutes.get("/", asyncHandler(usersController.list));
usersRoutes.get("/:id", asyncHandler(usersController.get));
usersRoutes.post("/", requirePermission("users:manage"), asyncHandler(usersController.create));
usersRoutes.put("/:id", requirePermission("users:manage"), asyncHandler(usersController.update));
usersRoutes.delete("/:id", requirePermission("users:manage"), asyncHandler(usersController.remove));
