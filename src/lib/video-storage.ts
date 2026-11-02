import "server-only";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { db } from "./db";
import { UPLOADED_VIDEO_NAME, UPLOADED_VIDEO_PREFIX, isUploadedVideo } from "./video";

/** Uploaded lesson videos live on disk here, outside public/ so every request goes through an access check. */
export const VIDEO_DIR = path.resolve(process.env.VIDEO_UPLOAD_DIR || "uploads/videos");

/** Largest accepted upload, in bytes (VIDEO_MAX_MB, default 2 GB). */
export const VIDEO_MAX_BYTES = (Number(process.env.VIDEO_MAX_MB) || 2048) * 1024 * 1024;

export const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
};

/** Absolute path for a stored file name, or null if the name isn't one we generate. */
export function videoFilePath(name: string) {
  return UPLOADED_VIDEO_NAME.test(name) ? path.join(VIDEO_DIR, name) : null;
}

/**
 * Deletes uploaded video files that no lesson points to any more. Call after a lesson's video is
 * replaced or lessons are deleted; failures are logged, never thrown.
 */
export async function removeUnusedVideos(urls: (string | null | undefined)[]) {
  for (const url of new Set(urls.filter((u): u is string => isUploadedVideo(u)))) {
    try {
      if (await db.lesson.count({ where: { videoUrl: url } })) continue;
      const file = videoFilePath(url.slice(UPLOADED_VIDEO_PREFIX.length));
      if (file) await unlink(file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.error("Could not remove video", url, err);
    }
  }
}
