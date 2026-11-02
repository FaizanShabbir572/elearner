/** Uploaded lesson videos are served from here (see src/app/api/videos/[file]/route.ts). */
export const UPLOADED_VIDEO_PREFIX = "/api/videos/";
export const UPLOADED_VIDEO_NAME = /^[a-z0-9]+\.(mp4|webm|m4v|mov|ogv)$/;

/** True for a path like /api/videos/abc123.mp4 produced by the upload endpoint. */
export function isUploadedVideo(raw: string | null | undefined): boolean {
  return !!raw && raw.startsWith(UPLOADED_VIDEO_PREFIX) && UPLOADED_VIDEO_NAME.test(raw.slice(UPLOADED_VIDEO_PREFIX.length));
}

/**
 * Turns a YouTube or Vimeo watch/share URL into an embeddable iframe URL. Uploaded video paths are
 * returned unchanged. Returns null if unrecognised.
 */
export function toEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (isUploadedVideo(raw.trim())) return raw.trim();
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    const m = url.pathname.match(/^\/(embed|shorts|live)\/([\w-]+)/);
    return m ? `https://www.youtube-nocookie.com/embed/${m[2]}` : null;
  }
  if (host === "vimeo.com") {
    const m = url.pathname.match(/^\/(\d+)(?:\/(\w+))?/);
    if (!m) return null;
    return `https://player.vimeo.com/video/${m[1]}${m[2] ? `?h=${m[2]}` : ""}`;
  }
  if (host === "player.vimeo.com") return url.toString();
  return null;
}

export type VideoProvider = "youtube" | "vimeo" | "file";

/** Which player API can control this embed URL (from toEmbedUrl). */
export function videoProvider(embedUrl: string): VideoProvider | null {
  if (isUploadedVideo(embedUrl)) return "file";
  if (embedUrl.startsWith("https://www.youtube-nocookie.com/embed/")) return "youtube";
  if (embedUrl.startsWith("https://player.vimeo.com/video/")) return "vimeo";
  return null;
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatTimestamp(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
