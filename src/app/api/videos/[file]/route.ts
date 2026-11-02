import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCourse } from "@/lib/courses";
import { UPLOADED_VIDEO_PREFIX } from "@/lib/video";
import { VIDEO_TYPES, videoFilePath } from "@/lib/video-storage";

/**
 * Streams an uploaded lesson video to anyone who may open a lesson that uses it (admins: always).
 * Supports Range requests so the browser can seek without downloading the whole file.
 */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const filePath = videoFilePath(file);
  if (!filePath) return new Response("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "ADMIN") {
    const lessons = await db.lesson.findMany({
      where: { videoUrl: `${UPLOADED_VIDEO_PREFIX}${file}` },
      select: { module: { select: { course: { select: { published: true, proficiencyLevel: true } } } } },
    });
    if (!lessons.some((l) => canAccessCourse(user, l.module.course))) return new Response("Not found", { status: 404 });
  }

  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": VIDEO_TYPES[path.extname(file).slice(1)] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (!range) {
    headers.set("Content-Length", String(size));
    return new Response(toWeb(createReadStream(filePath)), { headers });
  }

  // "bytes=500-" → from 500 to the end; "bytes=-500" → the last 500 bytes.
  let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (!range[1] && !range[2]) [start, end] = [0, size - 1];
  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(toWeb(createReadStream(filePath, { start, end })), { status: 206, headers });
}

function toWeb(stream: Readable) {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}
