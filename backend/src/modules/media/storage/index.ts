import { env } from "../../../config/env";
import { filesystemStorage } from "./filesystem.storage";
import { s3Storage } from "./s3.storage";
import { MediaStorage } from "./storage.interface";

// Provider is picked once, from MEDIA_PROVIDER in the single root .env —
// "filesystem" (default) or "s3" (AWS S3 / Cloudflare R2 / any S3-compatible).
export const mediaStorage: MediaStorage = env.media.provider === "s3" ? s3Storage : filesystemStorage;
