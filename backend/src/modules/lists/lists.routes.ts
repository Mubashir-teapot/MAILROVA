import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { listsController } from "./lists.controller";

export const listsRoutes = Router();

listsRoutes.use(requireAuth, requirePermission("lists:get_all", "lists:manage_all"));

listsRoutes.get("/", asyncHandler(listsController.list));
listsRoutes.get("/:id", asyncHandler(listsController.get));
listsRoutes.post("/", requirePermission("lists:manage_all"), asyncHandler(listsController.create));
listsRoutes.put("/:id", requirePermission("lists:manage_all"), asyncHandler(listsController.update));
listsRoutes.delete("/:id", requirePermission("lists:manage_all"), asyncHandler(listsController.remove));
