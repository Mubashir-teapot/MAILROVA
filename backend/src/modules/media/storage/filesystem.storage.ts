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
    return `/uploads/${filename}`;
  },
};
