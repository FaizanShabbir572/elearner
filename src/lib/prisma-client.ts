// Shared PrismaClient factory (used by the app and the seed script).
// Uses Prisma's Rust-free client engine with the libSQL driver adapter, which
// ships prebuilt binaries for Windows, macOS and Linux (no Python/compiler needed).
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * DATABASE_URL "file:./dev.db" is relative to the prisma/ folder (Prisma CLI convention).
 * Resolve it the same way here, using forward slashes so it also works on Windows.
 */
function sqliteUrl() {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  if (!raw.startsWith("file:")) return raw; // e.g. a remote libsql:// (Turso) URL
  const file = raw.slice("file:".length).replace(/\\/g, "/");
  const isAbsolute = file.startsWith("/") || /^[a-zA-Z]:\//.test(file);
  return isAbsolute ? `file:${file}` : `file:./prisma/${file.replace(/^\.\//, "")}`;
}

export function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaLibSQL({ url: sqliteUrl() }) });
}
