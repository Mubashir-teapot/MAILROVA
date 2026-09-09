import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { subscribersController } from "./subscribers.controller";

export const subscribersRoutes = Router();

subscribersRoutes.use(requireAuth, requirePermission("subscribers:get_all", "subscribers:manage"));

subscribersRoutes.get("/", asyncHandler(subscribersController.list));
subscribersRoutes.get("/:id", asyncHandler(subscribersController.get));
subscribersRoutes.post("/", requirePermission("subscribers:manage"), asyncHandler(subscribersController.create));
subscribersRoutes.put("/:id", requirePermission("subscribers:manage"), asyncHandler(subscribersController.update));
subscribersRoutes.delete("/:id", requirePermission("subscribers:manage"), asyncHandler(subscribersController.remove));
subscribersRoutes.put(
  "/:id/blocklist",
  requirePermission("subscribers:manage"),
  asyncHandler(subscribersController.blocklist)
);
subscribersRoutes.post(
  "/:id/unsubscribe",
  requirePermission("subscribers:manage"),
  asyncHandler(subscribersController.unsubscribeFromList)
);
