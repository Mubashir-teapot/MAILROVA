import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { mediaController } from "./media.controller";
import { uploadMedia } from "./media.upload";

export const mediaRoutes = Router();

mediaRoutes.use(requireAuth, requirePermission("media:get", "media:manage"));

mediaRoutes.get("/", asyncHandler(mediaController.list));
mediaRoutes.post(
  "/",
  requirePermission("media:manage"),
  uploadMedia.single("file"),
  asyncHandler(mediaController.upload)
);
mediaRoutes.delete("/:id", requirePermission("media:manage"), asyncHandler(mediaController.remove));
