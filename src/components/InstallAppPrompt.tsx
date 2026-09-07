import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useInstallPrompt,
  isInPreviewIframe,
  isIOS,
  isSafari,
  isStandalone,
} from "@/lib/installPrompt";

const DISMISS_KEY = "viketa_pwa_dismissed_at";
const DISMISS_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour — reappears aggressively

export function InstallAppPrompt() {
  const { canInstall, install } = useInstallPrompt();
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (isInPreviewIframe()) return;
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const cooledDown = Date.now() - dismissedAt > DISMISS_COOLDOWN_MS;

    if (canInstall && cooledDown) {
      setVisible(true);
      return;
    }

    if (isIOS() && isSafari() && cooledDown) {
      setIosMode(true);
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }
  }, [canInstall]);

  const handleInstall = async () => {
    const outcome = await install();
    if (outcome === "accepted") {
      setVisible(false);
    } else {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <img src="/logo.png" alt="Viketa" className="w-8 h-8 rounded-md" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-foreground text-base leading-tight">
                    Install the Viketa app
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Faster opens, push-style alerts, works like a real app on your home screen.
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  aria-label="Close"
                  className="shrink-0 -mr-1 -mt-1 p-1 rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {iosMode ? (
                <div className="mt-3 space-y-2 text-xs text-foreground/90">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">1</span>
                    <span className="flex items-center gap-1">Tap <Share className="w-3.5 h-3.5 inline" /> Share in Safari</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">2</span>
                    <span className="flex items-center gap-1">Choose <Plus className="w-3.5 h-3.5 inline" /> Add to Home Screen</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">3</span>
                    <span>Tap Add. Done — open Viketa from your home screen.</span>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleInstall}
                  size="sm"
                  className="mt-3 w-full gap-2"
                  disabled={!canInstall}
                >
                  <Download className="w-4 h-4" />
                  Install now — it's free
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
