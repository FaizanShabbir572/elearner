import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { VIDEO_DIR, VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/video-storage";
import { UPLOADED_VIDEO_PREFIX } from "@/lib/video";

/**
 * Admin video upload. The raw file is the request body (not multipart) so it streams straight to
 * disk; the original file name comes in the X-File-Name header. Responds with { url } to store
 * as the lesson's videoUrl.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const original = decodeURIComponent(req.headers.get("x-file-name") ?? "");
  const ext = path.extname(original).slice(1).toLowerCase();
  if (!VIDEO_TYPES[ext]) {
    return NextResponse.json({ error: "Unsupported file type. Upload an MP4, WebM, MOV, M4V or OGV video." }, { status: 415 });
  }
  const declared = Number(req.headers.get("content-length"));
  if (declared > VIDEO_MAX_BYTES) return tooLarge();
  if (!req.body) return NextResponse.json({ error: "The file is empty." }, { status: 400 });

  await mkdir(VIDEO_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}${randomBytes(8).toString("hex")}.${ext}`;
  const dest = path.join(VIDEO_DIR, name);

  let received = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      received += chunk.length;
      done(received > VIDEO_MAX_BYTES ? new Error("TOO_LARGE") : null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(req.body as WebReadableStream<Uint8Array>), limit, createWriteStream(dest));
  } catch (err) {
    await unlink(dest).catch(() => {});
    if ((err as Error).message === "TOO_LARGE") return tooLarge();
    console.error("Video upload failed", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
  if (received === 0) {
    await unlink(dest).catch(() => {});
    return NextResponse.json({ error: "The file is empty." }, { status: 400 });
  }

  return NextResponse.json({ url: `${UPLOADED_VIDEO_PREFIX}${name}` });
}

function tooLarge() {
  const mb = Math.round(VIDEO_MAX_BYTES / 1024 / 1024);
  return NextResponse.json({ error: `The file is larger than the ${mb} MB limit.` }, { status: 413 });
}
