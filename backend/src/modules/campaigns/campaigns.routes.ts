import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { campaignsController } from "./campaigns.controller";

export const campaignsRoutes = Router();

campaignsRoutes.use(requireAuth, requirePermission("campaigns:get_all", "campaigns:manage_all"));

campaignsRoutes.get("/", asyncHandler(campaignsController.list));
campaignsRoutes.get("/:id", asyncHandler(campaignsController.get));
campaignsRoutes.get("/:id/delivery-log", asyncHandler(campaignsController.deliveryLog));
campaignsRoutes.post("/", requirePermission("campaigns:manage_all"), asyncHandler(campaignsController.create));
campaignsRoutes.put("/:id", requirePermission("campaigns:manage_all"), asyncHandler(campaignsController.update));
campaignsRoutes.delete("/:id", requirePermission("campaigns:manage_all"), asyncHandler(campaignsController.remove));
campaignsRoutes.put(
  "/:id/status",
  requirePermission("campaigns:send"),
  asyncHandler(campaignsController.setStatus)
);
