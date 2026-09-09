import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { mailboxesController } from "./mailboxes.controller";

export const mailboxesRoutes = Router();

mailboxesRoutes.use(requireAuth);

mailboxesRoutes.get("/mine", asyncHandler(mailboxesController.mine));
mailboxesRoutes.get("/", requirePermission("users:get", "users:manage"), asyncHandler(mailboxesController.list));
mailboxesRoutes.post("/", requirePermission("users:manage"), asyncHandler(mailboxesController.create));
mailboxesRoutes.delete("/:id", requirePermission("users:manage"), asyncHandler(mailboxesController.remove));
mailboxesRoutes.put("/:id/password", requirePermission("users:manage"), asyncHandler(mailboxesController.setPassword));
mailboxesRoutes.put("/:id/enabled", requirePermission("users:manage"), asyncHandler(mailboxesController.setEnabled));
mailboxesRoutes.put("/:id/daily-cap", requirePermission("users:manage"), asyncHandler(mailboxesController.setDailyCap));
mailboxesRoutes.put("/:id/users", requirePermission("users:manage"), asyncHandler(mailboxesController.assignUsers));
