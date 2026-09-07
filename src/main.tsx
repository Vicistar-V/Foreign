import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import "./index.css";
import { initVersionCheck } from "./lib/versionCheck";
import { initLogRocket } from "./lib/logrocket";
import { captureExplainerSkipFromUrl, getSkipExplainerParamName } from "./lib/explainerSkip";

// Start LogRocket as early as possible so we capture the full first-paint
// of the session (including unauthenticated landing pages). The init is a
// no-op on localhost / lovable preview hosts.
initLogRocket();

// Capture the "skip explainer" flag (?xse=1) as early as possible — BEFORE
// React mounts and BEFORE any router/auth redirect can drop query params.
// This runs regardless of CloakGate, so users landing on /signup, /login,
// or any deep link with ?xse=1 have the flag persisted for ProtectedRoute
// to honor after they authenticate.
try {
  const captured = captureExplainerSkipFromUrl();
  if (captured) {
    const url = new URL(window.location.href);
    url.searchParams.delete(getSkipExplainerParamName());
    const clean =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
      url.hash;
    window.history.replaceState({}, "", clean);
  }
} catch {
  /* noop */
}

// ----------------------------------------------------------------------
// Service worker REMOVAL.
// The old SW was caching the app shell and Supabase GETs aggressively,
// so users couldn't see UI updates after we shipped new builds. We have
// shipped a kill-switch /sw.js that unregisters itself on activate, but
// we ALSO unregister here on every load so we don't depend on the old
// SW ever fetching the new one. Plus we clear all caches.
// ----------------------------------------------------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister().catch(() => {}));
  }).catch(() => {});

  if (typeof caches !== "undefined") {
    caches.keys().then((names) => {
      names.forEach((n) => caches.delete(n).catch(() => {}));
    }).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);

// Start the new-build watcher (no-op in dev/preview).
initVersionCheck();

