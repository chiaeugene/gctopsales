"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Records which pages an agent opens, once per page per browser session.
 *
 * Once per session, not per visit, because the useful question is "did they ever
 * get to Connect today" rather than how many times they bounced off the
 * dashboard — and because a write per navigation would be a lot of rows for a
 * number nobody reads that precisely.
 */
export function ActivityPing() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const key = `gc-seen-${pathname}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch("/api/activity/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
