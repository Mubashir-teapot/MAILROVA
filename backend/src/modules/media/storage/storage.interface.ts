export interface StoredFile {
  filename: string;
  url: string;
}

export interface MediaStorage {
  save(buffer: Buffer, filename: string, contentType: string): Promise<StoredFile>;
  remove(filename: string): Promise<void>;
  urlFor(filename: string): string;
}
