"use client";
import { useEffect, useState } from "react";

/** Requests faster than this finish without the bar flashing. */
const SHOW_AFTER_MS = 100;

/** Page changes and server actions, which Next.js marks with these headers. Prefetches are background work. */
function isAppRequest(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return (headers.has("rsc") || headers.has("next-action")) && !headers.has("next-router-prefetch");
}

/**
 * The bar across the top of the app while any page change or action is in flight. Next.js sends
 * both through window.fetch, so counting them here covers every request without touching each form.
 */
export function AppLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch;
    let active = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      active -= 1;
      if (active > 0) return;
      clearTimeout(timer);
      setVisible(false);
    };

    window.fetch = (input, init) => {
      if (!isAppRequest(input, init)) return originalFetch(input, init);
      active += 1;
      if (active === 1) timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      return originalFetch(input, init).finally(finish);
    };

    return () => {
      window.fetch = originalFetch;
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="app-loader" role="progressbar" aria-label="Loading" data-app-loader>
      <div className="app-loader-bar" />
    </div>
  );
}
