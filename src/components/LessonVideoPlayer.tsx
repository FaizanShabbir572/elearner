"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { videoProvider } from "@/lib/video";

/**
 * A lesson video that other components can control (read the current time, seek, play, pause).
 * YouTube uses the IFrame Player API, Vimeo uses @vimeo/player. If the API can't load, the plain
 * iframe keeps working and getCurrentTime() resolves to null.
 *
 * Wrap the player and anything that controls it in <VideoPlayerProvider>, then call useVideoPlayer().
 */

export type ProgressEvent = { currentTime: number; duration: number | null };

type Controller = {
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number | null>;
  isPlaying(): Promise<boolean>;
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
};

export type VideoPlayerApi = {
  /** True once the player API is connected; false for the plain-iframe fallback or no video. */
  ready: boolean;
  getCurrentTime(): Promise<number | null>;
  seekTo(seconds: number): void;
  play(): void;
  pause(): void;
  /** Called about every 10 s while the video is playing. Returns an unsubscribe function. */
  onProgress(cb: (e: ProgressEvent) => void): () => void;
  /** Scrolls the player into view (used when jumping to a timestamp). */
  scrollIntoView(): void;
};

type Internal = Omit<VideoPlayerApi, "ready"> & {
  _setController(c: Controller | null): void;
  _emit(e: ProgressEvent): void;
  _container: React.RefObject<HTMLDivElement | null>;
};

// The controls object is stable for the provider's lifetime; `ready` lives in its own context
// so that flipping it doesn't re-run the player's connect effect.
const Ctx = createContext<Internal | null>(null);
const ReadyCtx = createContext(false);

export function VideoPlayerProvider({ children }: { children: React.ReactNode }) {
  const controller = useRef<Controller | null>(null);
  const listeners = useRef(new Set<(e: ProgressEvent) => void>());
  const container = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  const _setController = useCallback((c: Controller | null) => {
    controller.current = c;
    setReady(c !== null);
  }, []);

  const api = useMemo<Internal>(() => ({
    getCurrentTime: async () => {
      try {
        return controller.current ? Math.floor(await controller.current.getCurrentTime()) : null;
      } catch {
        return null;
      }
    },
    seekTo: (s) => controller.current?.seekTo(s),
    play: () => controller.current?.play(),
    pause: () => controller.current?.pause(),
    onProgress: (cb) => {
      listeners.current.add(cb);
      return () => listeners.current.delete(cb);
    },
    scrollIntoView: () => container.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    _setController,
    _emit: (e) => listeners.current.forEach((cb) => cb(e)),
    _container: container,
  }), [_setController]);

  return (
    <Ctx.Provider value={api}>
      <ReadyCtx.Provider value={ready}>{children}</ReadyCtx.Provider>
    </Ctx.Provider>
  );
}

/** Player controls; safe to call outside a provider (everything becomes a no-op). */
export function useVideoPlayer(): VideoPlayerApi {
  const api = useContext(Ctx);
  const ready = useContext(ReadyCtx);
  return useMemo(() => (api ? { ...api, ready } : NOOP), [api, ready]);
}

const NOOP: VideoPlayerApi = {
  ready: false,
  getCurrentTime: async () => null,
  seekTo: () => {},
  play: () => {},
  pause: () => {},
  onProgress: () => () => {},
  scrollIntoView: () => {},
};

// ---------- YouTube ----------

type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(s: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
};
type YTNamespace = { Player: new (el: HTMLIFrameElement, opts: { events: { onReady: () => void } }) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApi: Promise<YTNamespace> | null = null;

/** Loads https://www.youtube.com/iframe_api once per page. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  ytApi ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      ytApi = null; // allow a retry on the next lesson
      reject(new Error("YouTube API failed to load"));
    };
    document.head.appendChild(script);
  });
  return ytApi;
}

function connectYouTube(iframe: HTMLIFrameElement): Promise<Controller> {
  return loadYouTubeApi().then(
    (YT) =>
      new Promise<Controller>((resolve) => {
        const p: YTPlayer = new YT.Player(iframe, {
          events: {
            onReady: () =>
              resolve({
                getCurrentTime: async () => p.getCurrentTime(),
                getDuration: async () => p.getDuration() || null,
                isPlaying: async () => p.getPlayerState() === 1,
                seekTo: (s) => p.seekTo(s, true),
                play: () => p.playVideo(),
                pause: () => p.pauseVideo(),
              }),
          },
        });
      })
  );
}

// ---------- Vimeo ----------

async function connectVimeo(iframe: HTMLIFrameElement): Promise<Controller> {
  const { default: Player } = await import("@vimeo/player");
  const p = new Player(iframe);
  await p.ready();
  return {
    getCurrentTime: () => p.getCurrentTime(),
    getDuration: async () => (await p.getDuration()) || null,
    isPlaying: async () => !(await p.getPaused()),
    seekTo: (s) => void p.setCurrentTime(s).catch(() => {}),
    play: () => void p.play().catch(() => {}),
    pause: () => void p.pause().catch(() => {}),
  };
}

// ---------- Uploaded file (<video>) ----------

async function connectFile(video: HTMLVideoElement): Promise<Controller> {
  return {
    getCurrentTime: async () => video.currentTime,
    getDuration: async () => (Number.isFinite(video.duration) && video.duration) || null,
    isPlaying: async () => !video.paused && !video.ended,
    seekTo: (s) => {
      video.currentTime = s;
    },
    play: () => void video.play().catch(() => {}),
    pause: () => video.pause(),
  };
}

// ---------- Player ----------

const CONNECT_TIMEOUT_MS = 10_000;
const PROGRESS_INTERVAL_MS = 10_000;
// Neither player API supports a clean detach (destroy() removes the iframe), so connect once per element.
const connections = new WeakMap<HTMLElement, Promise<Controller>>();

function withStart(embedUrl: string, provider: ReturnType<typeof videoProvider>, startAt?: number | null) {
  // Uploaded files are same-origin paths; a media fragment sets the start time.
  if (provider === "file") return startAt ? `${embedUrl}#t=${startAt}` : embedUrl;
  const url = new URL(embedUrl);
  if (provider === "youtube") {
    url.searchParams.set("enablejsapi", "1");
    url.searchParams.set("rel", "0");
    if (startAt) url.searchParams.set("start", String(startAt));
  }
  if (provider === "vimeo" && startAt) url.hash = `t=${startAt}s`;
  return url.toString();
}

export function LessonVideoPlayer({ embedUrl, title, startAt }: { embedUrl: string; title: string; startAt?: number | null }) {
  const ctx = useContext(Ctx);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const provider = videoProvider(embedUrl);
  const src = withStart(embedUrl, provider, startAt);

  useEffect(() => {
    const el = provider === "file" ? videoRef.current : iframeRef.current;
    if (!el || !provider || !ctx) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    let connection = connections.get(el);
    if (!connection) {
      connection = Promise.race([
        el instanceof HTMLVideoElement ? connectFile(el)
          : provider === "youtube" ? connectYouTube(el as HTMLIFrameElement) : connectVimeo(el as HTMLIFrameElement),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Player API timed out")), CONNECT_TIMEOUT_MS)),
      ]);
      connections.set(el, connection);
    }

    connection
      .then((c) => {
        if (cancelled) return;
        ctx._setController(c);
        timer = setInterval(async () => {
          try {
            if (!(await c.isPlaying())) return;
            const [currentTime, duration] = await Promise.all([c.getCurrentTime(), c.getDuration()]);
            ctx._emit({ currentTime, duration });
          } catch {
            /* player went away; ignore */
          }
        }, PROGRESS_INTERVAL_MS);
      })
      .catch(() => {
        // Fallback: the plain iframe still plays, timestamps become null.
        connections.delete(el);
      });

    return () => {
      cancelled = true;
      clearInterval(timer);
      ctx._setController(null);
    };
  }, [ctx, provider, src]);

  return (
    <div ref={ctx?._container} className="mb-8 aspect-video scroll-mt-6 overflow-hidden rounded-xl bg-black shadow-sm">
      {/* key: a new start time means a fresh element (and a fresh API connection). */}
      {provider === "file" ? (
        <video key={src} ref={videoRef} src={src} className="h-full w-full" title={title} controls playsInline preload="metadata"
          controlsList="nodownload" onContextMenu={(e) => e.preventDefault()} />
      ) : (
        <iframe key={src} ref={iframeRef} src={src} className="h-full w-full" title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
      )}
    </div>
  );
}
