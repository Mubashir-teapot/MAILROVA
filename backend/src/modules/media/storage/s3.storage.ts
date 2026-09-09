import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../../../config/env";
import { MediaStorage } from "./storage.interface";

// Works for AWS S3, Cloudflare R2, MinIO, or any S3-compatible endpoint —
// point S3_ENDPOINT at R2's account endpoint and set S3_FORCE_PATH_STYLE=true.
const client = new S3Client({
  region: env.media.s3.region,
  endpoint: env.media.s3.endpoint,
  forcePathStyle: env.media.s3.forcePathStyle,
  credentials: env.media.s3.accessKeyId
    ? { accessKeyId: env.media.s3.accessKeyId, secretAccessKey: env.media.s3.secretAccessKey }
    : undefined,
});

export const s3Storage: MediaStorage = {
  async save(buffer, filename, contentType) {
    await client.send(
      new PutObjectCommand({
        Bucket: env.media.s3.bucket,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { filename, url: s3Storage.urlFor(filename) };
  },

  async remove(filename) {
    await client.send(new DeleteObjectCommand({ Bucket: env.media.s3.bucket, Key: filename }));
  },

  urlFor(filename) {
    if (env.media.s3.publicUrl) return `${env.media.s3.publicUrl.replace(/\/$/, "")}/${filename}`;
    const base = env.media.s3.endpoint ?? `https://s3.${env.media.s3.region}.amazonaws.com`;
    return `${base.replace(/\/$/, "")}/${env.media.s3.bucket}/${filename}`;
  },
};
