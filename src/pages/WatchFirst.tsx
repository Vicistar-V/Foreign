import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExplainerVideo } from '@/components/ExplainerVideo';
import { PageSEO } from '@/components/PageSEO';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { useExplainerVideoSettings } from '@/hooks/useExplainerVideoSettings';
import {
  markWatchedBeforeSignup,
  storeExplainerSkip,
} from '@/lib/explainerSkip';

/** Hard escape hatch: never trap anyone on this page longer than this. */
const MAX_WAIT_MS = 180_000; // 3 minutes
/** If the video can't load/play at all, open the button quickly. */
const BROKEN_VIDEO_MS = 8_000;


/**
 * Pre-signup explainer. Everyone who opens the sign-up page WITHOUT the
 * skip flag is bounced here first. Once they watch 90%, we store the skip
 * flag so the post-signup explainer gate never shows them the video twice.
 */
const WatchFirst = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const settings = useExplainerVideoSettings();
  const [duration, setDuration] = useState(settings.durationSeconds || 0);



  // Only allow internal paths — never an open redirect.
  const next = useMemo(() => {
    const raw = params.get('next') || '/signup';
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/signup';
  }, [params]);

  useEffect(() => {
    trackClarityEvent(ClarityEvents.EXPLAINER_PAGE_VIEWED);
  }, []);

  // Safety net #1: time-based. Even if progress events never fire (bad codec,
  // slow network, background tab throttling), the button opens.
  useEffect(() => {
    const t = window.setTimeout(() => setFallbackOpen(true), MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Safety net #2: the video reported an error — open the gate almost at once.
  const handleVideoError = () => {
    window.setTimeout(() => setFallbackOpen(true), BROKEN_VIDEO_MS);
  };

  const watched = progress >= settings.requiredFraction;
  const unlocked = watched || fallbackOpen;
  const percent = Math.min(100, Math.round(progress * 100));
  const requiredPercent = Math.round(settings.requiredFraction * 100);


  // Real length of the video, in plain words. Falls back to "short" until the
  // browser tells us how long the file is.
  const lengthWords = useMemo(() => {
    if (!duration) return 'short';
    const total = Math.round(duration);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    if (mins === 0) return `${secs}-second`;
    if (secs === 0) return `${mins}-minute`;
    return `${mins} min ${secs} sec`;
  }, [duration]);

  const proceed = () => {
    if (!unlocked) return;
    trackClarityEvent(ClarityEvents.EXPLAINER_WATCHED_CONTINUE_CLICKED);
    // Both flags: one gets consumed by ProtectedRoute after it writes to the
    // database, the other stays forever on this device.
    storeExplainerSkip();
    markWatchedBeforeSignup();
    navigate(next, { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <PageSEO
        title="Watch This First | Viketa"
        description="See how the money lands in your hands — a short video."
        path="/watch-first"
        noIndex
      />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-4 pt-4">
        <div className="shrink-0 text-center">
          <h1 className="text-lg font-bold text-foreground sm:text-xl">
            Watch this {lengthWords} video first
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            See exactly how the money lands in your hands before you sign up.
          </p>
        </div>

        <div className="my-3 flex min-h-0 flex-1 items-center justify-center">
          <div
            className="w-full"
            style={{
              maxWidth: `min(100%, calc((100dvh - 260px) * ${settings.aspect || 9 / 16}))`,
            }}
          >
            <ExplainerVideo
              onProgress={(f) => setProgress((prev) => (f > prev ? f : prev))}
              onError={handleVideoError}
              onDuration={setDuration}
            />
          </div>
        </div>


        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                  unlocked ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="tabular-nums">
              {watched ? 'Unlocked' : fallbackOpen ? 'You can go on' : `${percent}% watched`}
            </span>
          </div>

          <Button
            size="lg"
            className="h-12 w-full rounded-2xl text-base font-semibold"
            onClick={proceed}
            disabled={!unlocked}
            haptic="medium"
          >
            {unlocked ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {unlocked ? 'Continue to sign up' : 'Watch video first to continue'}
            {unlocked && <ArrowRight className="h-4 w-4" />}
          </Button>
          {!unlocked && (
            <p className="text-center text-[11px] text-muted-foreground">
              The button opens once you've watched at least {requiredPercent}% of the video.
            </p>
          )}
          {!watched && fallbackOpen && (
            <p className="text-center text-[11px] text-muted-foreground">
              Video giving you trouble? You can carry on now.
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default WatchFirst;
