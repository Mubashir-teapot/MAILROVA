import express, { Router } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { bounceWebhooksController } from "./bounces.webhooks.controller";

// Mounted directly at /webhooks/bounce (not under /api) — these are called by
// ESPs, not the admin frontend, and authenticate their own way (shared
// secret / basic auth / SNS handshake) rather than a bearer token.
export const bounceWebhooksRoutes = Router();

// SNS posts SES notifications as `text/plain`, not JSON — parse as text and
// let the controller JSON.parse it itself.
bounceWebhooksRoutes.post("/ses", express.text({ type: "*/*" }), asyncHandler(bounceWebhooksController.ses));
bounceWebhooksRoutes.post("/sendgrid", asyncHandler(bounceWebhooksController.sendgrid));
bounceWebhooksRoutes.post("/postmark", asyncHandler(bounceWebhooksController.postmark));
