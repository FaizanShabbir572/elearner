"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const INTERVAL_MS = 60 * 1000;

/**
 * Keeps the login session alive while the tab is visible (e.g. while watching a video), and
 * refreshes the app shell when the unread notification count changes, so a reminder shows up
 * without the student reloading.
 */
export function Heartbeat({ unread }: { unread: number }) {
  const router = useRouter();
  const knownUnread = useRef(unread);
  useEffect(() => {
    knownUnread.current = unread;
  }, [unread]);

  useEffect(() => {
    const beat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/heartbeat", { method: "POST", cache: "no-store" });
        const data = await res.json();
        if (typeof data.unread === "number" && data.unread !== knownUnread.current) router.refresh();
      } catch {
        // A missed beat is harmless; the next one retries.
      }
    };
    const timer = setInterval(beat, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
