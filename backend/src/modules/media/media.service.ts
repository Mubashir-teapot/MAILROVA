import crypto from "crypto";
import path from "path";
import { ApiError } from "../../common/utils/ApiError";
import { env } from "../../config/env";
import { mediaRepository } from "./media.repository";
import { mediaStorage } from "./storage";

function withUrl<T extends { filename: string }>(media: T) {
  return { ...media, url: mediaStorage.urlFor(media.filename) };
}

export const mediaService = {
  async list(tenantId: number) {
    const rows = await mediaRepository.findAll(tenantId);
    return rows.map(withUrl);
  },

  async get(tenantId: number, id: number) {
    const media = await mediaRepository.findById(tenantId, id);
    if (!media) throw ApiError.notFound("Media not found");
    return withUrl(media);
  },

  async upload(tenantId: number, buffer: Buffer, originalName: string, contentType: string) {
    const filename = `${crypto.randomBytes(8).toString("hex")}${path.extname(originalName)}`;
    const stored = await mediaStorage.save(buffer, filename, contentType);
    const media = await mediaRepository.create({
      tenant: { connect: { id: tenantId } },
      filename: stored.filename,
      contentType,
      provider: env.media.provider,
    });
    return { ...media, url: stored.url };
  },

  async remove(tenantId: number, id: number) {
    const media = await mediaRepository.findById(tenantId, id);
    if (!media) throw ApiError.notFound("Media not found");
    await mediaStorage.remove(media.filename).catch(() => undefined);
    await mediaRepository.remove(tenantId, id);
  },
};
