import fs from "fs/promises";
import path from "path";
import { env } from "../../../config/env";
import { MediaStorage } from "./storage.interface";

export const filesystemStorage: MediaStorage = {
  async save(buffer, filename) {
    await fs.mkdir(env.uploadDir, { recursive: true });
    await fs.writeFile(path.join(env.uploadDir, filename), buffer);
    return { filename, url: filesystemStorage.urlFor(filename) };
  },

  async remove(filename) {
    await fs.rm(path.join(env.uploadDir, filename), { force: true });
  },

  urlFor(filename) {
    // Must be absolute, not just "/uploads/x" — this same URL gets embedded
    // verbatim into outgoing campaign HTML (see blocks.ts's <img src=...>),
    // and a relative path has nothing to resolve against inside an email
    // client (there's no "current page" the way there is in a browser), so
    // the image silently fails to load for recipients even though it looks
    // fine in the admin UI.
    return `${env.publicUrl}/uploads/${filename}`;
  },
};
