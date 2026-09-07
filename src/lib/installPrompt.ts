import { useEffect, useState } from "react";

/**
 * Shared PWA install-prompt store. The browser only fires
 * `beforeinstallprompt` once, so we capture it globally and let any
 * component (the big bottom drawer OR the small header badge) use it.
 */

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let captured: BIPEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    captured = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    captured = null;
    emit();
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if ((window.navigator as any).standalone === true) return true;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  if (document.referrer.startsWith("android-app://")) return true;
  return false;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const iPadOS =
    navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return iOS || iPadOS;
}

export function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return (
    ua.includes("safari") &&
    !ua.includes("crios") &&
    !ua.includes("fxios") &&
    !ua.includes("chrome")
  );
}

export function isInPreviewIframe(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost") return true;
  if (host.includes("lovableproject.com")) return true;
  if (host.includes("lovable.app") && host.includes("preview")) return true;
  return false;
}

export async function triggerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!captured) return "unavailable";
  try {
    await captured.prompt();
    const { outcome } = await captured.userChoice;
    if (outcome === "accepted") {
      captured = null;
      emit();
    }
    return outcome;
  } catch {
    return "unavailable";
  }
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((n) => n + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  return {
    canInstall: !!captured && !installed && !isStandalone(),
    isStandalone: isStandalone(),
    isIOSSafari: isIOS() && isSafari() && !isStandalone(),
    install: triggerInstall,
  };
}
