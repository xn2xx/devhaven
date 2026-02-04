import { useEffect, useState } from "react";

export type SystemColorScheme = "light" | "dark";

function getInitialScheme(): SystemColorScheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** 监听系统浅/深色偏好，默认返回 dark（在非浏览器环境下）。 */
export function useSystemColorScheme(): SystemColorScheme {
  const [scheme, setScheme] = useState<SystemColorScheme>(() => getInitialScheme());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setScheme(media.matches ? "dark" : "light");
    handler();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    // Safari < 14
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, []);

  return scheme;
}

