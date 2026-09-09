import { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { requireAuth } from "../../common/middleware/auth.middleware";
import { loginRateLimit } from "../../common/middleware/rateLimit";
import { authController } from "./auth.controller";

export const authRoutes = Router();

authRoutes.post("/login", loginRateLimit, asyncHandler(authController.login));
authRoutes.post("/logout", asyncHandler(authController.logout));
authRoutes.get("/me", requireAuth, asyncHandler(authController.me));
