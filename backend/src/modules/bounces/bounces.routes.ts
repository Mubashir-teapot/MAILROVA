import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth, requirePermission } from "../../common/middleware/auth.middleware";
import { bouncesController } from "./bounces.controller";

export const bouncesRoutes = Router();

bouncesRoutes.use(requireAuth);

bouncesRoutes.get("/", requirePermission("bounces:get", "bounces:manage"), asyncHandler(bouncesController.list));
// Intended for an API-key user scoped to just `webhooks:post_bounce`, e.g. a
// small script relaying ESP bounce webhooks (see FEATURES.md §10 for the six
// providers the source app parses natively — not reimplemented here).
bouncesRoutes.post(
  "/",
  requirePermission("webhooks:post_bounce", "bounces:manage"),
  asyncHandler(bouncesController.record)
);
bouncesRoutes.delete("/:id", requirePermission("bounces:manage"), asyncHandler(bouncesController.remove));
