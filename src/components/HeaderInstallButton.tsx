import { useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/installPrompt";

/**
 * Tiny "Install" pill rendered in the header. Always visible whenever
 * the app is installable but not yet installed — so users who dismissed
 * the big bottom drawer never lose the option.
 *
 * - Android/Chrome with a captured BIP event → tap fires native install.
 * - iOS Safari → opens a small modal with Share → Add to Home Screen.
 * - Hidden once the app is already running standalone.
 */
export function HeaderInstallButton() {
  const { canInstall, isStandalone, isIOSSafari, install } = useInstallPrompt();
  const [iosOpen, setIosOpen] = useState(false);

  if (isStandalone) return null;
  if (!canInstall && !isIOSSafari) return null;

  const handleClick = async () => {
    if (canInstall) {
      const outcome = await install();
      if (outcome === "unavailable" && isIOSSafari) setIosOpen(true);
      return;
    }
    if (isIOSSafari) setIosOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-semibold hover:bg-primary/15 active:scale-95 transition-all"
        aria-label="Install Viketa app"
      >
        <Download className="w-3.5 h-3.5" />
        Install
      </button>

      <Dialog open={iosOpen} onOpenChange={setIosOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Viketa to your Home Screen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground/90">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold">
                1
              </span>
              <span className="flex items-center gap-1">
                Tap <Share className="w-4 h-4 inline" /> Share at the bottom of Safari
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold">
                2
              </span>
              <span className="flex items-center gap-1">
                Choose <Plus className="w-4 h-4 inline" /> Add to Home Screen
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold">
                3
              </span>
              <span>Tap Add. Open Viketa from your home screen like a real app.</span>
            </div>
          </div>
          <Button onClick={() => setIosOpen(false)} className="w-full mt-2">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
