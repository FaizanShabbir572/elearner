"use client";
import { useEffect } from "react";

const INTERVAL_MS = 60 * 1000;

/** Keeps the login session alive while the tab is visible (e.g. while watching a video). */
export function Heartbeat() {
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/heartbeat", { method: "POST", cache: "no-store" }).catch(() => {});
    };
    const timer = setInterval(beat, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return null;
}
