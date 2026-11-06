import "server-only";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { Readable } from "node:stream";
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

const BUNNY_FOLDER = "lesson-videos";

/** New uploads go to Bunny Storage when it is configured; otherwise they stay on this server's disk. */
export const bunnyEnabled = () => Boolean(process.env.BUNNY_STORAGE_ENDPOINT && process.env.BUNNY_STORAGE_KEY);

// The storage key stays on the server: browsers only ever talk to /api/videos.
function bunnyRequest(name: string, init: RequestInit & { duplex?: "half" } = {}) {
  const url = `${process.env.BUNNY_STORAGE_ENDPOINT!.replace(/\/$/, "")}/${BUNNY_FOLDER}/${name}`;
  return fetch(url, { ...init, cache: "no-store", headers: { ...init.headers, AccessKey: process.env.BUNNY_STORAGE_KEY! } });
}

/** Streams a file to Bunny Storage. Throws if Bunny doesn't accept it. */
export async function uploadToBunny(name: string, source: AsyncIterable<Uint8Array>) {
  const res = await bunnyRequest(name, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: Readable.toWeb(Readable.from(source)) as ReadableStream<Uint8Array>,
    duplex: "half",
  });
  if (!res.ok) throw new Error(`Bunny upload failed: HTTP ${res.status}`);
}

/** Reads a video from Bunny Storage, passing on the browser's Range header so seeking works. */
export function fetchFromBunny(name: string, range: string | null, signal: AbortSignal) {
  return bunnyRequest(name, { headers: range ? { Range: range } : {}, signal });
}

/** Deletes a video from Bunny Storage. A file that is already gone counts as deleted. */
export async function deleteFromBunny(name: string) {
  const res = await bunnyRequest(name, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Bunny delete failed: HTTP ${res.status}`);
}

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
      const name = url.slice(UPLOADED_VIDEO_PREFIX.length);
      const file = videoFilePath(name);
      if (file) {
        await unlink(file).catch((err: NodeJS.ErrnoException) => {
          if (err.code !== "ENOENT") throw err;
        });
      }
      if (bunnyEnabled()) await deleteFromBunny(name);
    } catch (err) {
      console.error("Could not remove video", url, err);
    }
  }
}
