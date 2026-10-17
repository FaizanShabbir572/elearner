"use client";
import { useEffect, useRef } from "react";
import { recordWatchProgress } from "@/app/actions/revision";
import { useVideoPlayer } from "./LessonVideoPlayer";

const SEND_EVERY_MS = 20_000;

/** Records how far the student has watched, at most once every 20 s while the video plays. */
export function WatchTracker({ lessonId }: { lessonId: string }) {
  const player = useVideoPlayer();
  const lastSent = useRef(0);

  useEffect(() => {
    return player.onProgress(({ currentTime, duration }) => {
      const now = Date.now();
      if (now - lastSent.current < SEND_EVERY_MS - 1000) return;
      lastSent.current = now;
      recordWatchProgress(lessonId, currentTime, duration).catch(() => {});
    });
  }, [player, lessonId]);

  return null;
}
