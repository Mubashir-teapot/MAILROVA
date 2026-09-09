import multer from "multer";

// Files are buffered in memory, then handed to whichever MediaStorage
// provider is active (filesystem or S3/R2) — see storage/index.ts.
export const uploadMedia = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
