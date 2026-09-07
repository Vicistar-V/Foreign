import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { logUserActivity } from '@/lib/userActivityLogger';
import { useExplainerVideoSettings } from '@/hooks/useExplainerVideoSettings';

interface ExplainerVideoProps {
  /** Video address. Leave empty to use whatever the admin uploaded. */
  src?: string;
  /** Still picture shown before play. Leave empty to use the admin's picture. */
  poster?: string;
  /** Fallback shape while we still don't know the real one. */
  aspectClassName?: string;
  className?: string;
  /** Start playing (silently) as soon as it is on screen. */
  autoPlay?: boolean;
  /** Show the big "tap to watch" circle before the first play. */
  showPlayOverlay?: boolean;
  /** Fires with 0..1 — the furthest point the person has actually watched. */
  onProgress?: (fraction: number) => void;
  /** Fires when the video cannot load or play at all. */
  onError?: () => void;
  /** Fires once we know how long the video really is. */
  onDuration?: (seconds: number) => void;
  /**
   * Locked player: no browser controls, nothing to drag, no way to jump
   * forward. People can only pause, un-pause and mute. Default: true.
   */
  locked?: boolean;
}

const formatClock = (secs: number) => {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const total = Math.round(secs);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * The one video player used for the "watch this first" screen and the landing
 * pages. It streams the file with normal HTTP range requests, so playback
 * starts almost right away, and it cannot be dragged forward — the person has
 * to actually watch.
 */
export const ExplainerVideo = ({
  src,
  poster,
  aspectClassName = 'aspect-[9/16]',
  className,
  autoPlay = false,
  showPlayOverlay = true,
  onProgress,
  onError,
  onDuration,
  locked = true,
}: ExplainerVideoProps) => {
  const settings = useExplainerVideoSettings();
  const resolvedSrc = src ?? settings.videoUrl;
  const resolvedPoster = poster ?? settings.posterUrl;

  const videoRef = useRef<HTMLVideoElement>(null);
  const maxFractionRef = useRef(0);
  /** Furthest second the person is allowed to be at (blocks skipping ahead). */
  const watchedSecondsRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(autoPlay);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(autoPlay);
  const [duration, setDuration] = useState(settings.durationSeconds || 0);
  const [current, setCurrent] = useState(0);
  const [naturalAspect, setNaturalAspect] = useState(settings.aspect || 0);

  // Reset everything when the video address changes (e.g. admin uploaded a
  // new one while the page was open).
  useEffect(() => {
    maxFractionRef.current = 0;
    watchedSecondsRef.current = 0;
    setIsReady(false);
    setCurrent(0);
    setHasStarted(autoPlay);
    setIsPlaying(false);
    setDuration(settings.durationSeconds || 0);
    setNaturalAspect(settings.aspect || 0);
  }, [resolvedSrc]);

  // Pick up the real shape + length straight from the file.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => {
      setIsReady(true);
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setNaturalAspect(video.videoWidth / video.videoHeight);
      }
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
        onDuration?.(video.duration);
      }
    };
    video.addEventListener('loadedmetadata', onLoaded);
    if (video.readyState >= 1) onLoaded();
    return () => video.removeEventListener('loadedmetadata', onLoaded);
  }, [resolvedSrc, onDuration]);

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!hasStarted) {
      trackClarityEvent(ClarityEvents.EXPLAINER_VIDEO_PLAY_CLICKED);
      logUserActivity('explainer_video_played', 'button_click');
    }
    setHasStarted(true);
    try {
      await video.play();
    } catch (err) {
      console.warn('[ExplainerVideo] play() blocked, retrying muted', err);
      video.muted = true;
      setIsMuted(true);
      await video.play().catch(() => {});
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void handlePlay();
    } else {
      video.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const percentWatched = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;
  const remaining = duration > 0 ? Math.max(0, duration - current) : 0;
  const knownClock = duration > 0 ? formatClock(duration) : '';

  return (
    <div
      className={cn(
        'relative w-full select-none overflow-hidden rounded-2xl bg-black shadow-strong',
        !naturalAspect && aspectClassName,
        className,
      )}
      style={naturalAspect ? { aspectRatio: String(naturalAspect) } : undefined}
    >
      <video
        ref={videoRef}
        key={resolvedSrc}
        src={resolvedSrc}
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
        controls={!locked && hasStarted}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        muted={isMuted}
        autoPlay={autoPlay}
        poster={resolvedPoster || undefined}
        preload="auto"
        onContextMenu={(e) => locked && e.preventDefault()}
        onWaiting={() => setIsBuffering(true)}
        onStalled={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onCanPlay={() => setIsBuffering(false)}
        onError={() => {
          setIsBuffering(false);
          onError?.();
        }}
        onSeeking={(e) => {
          if (!locked) return;
          const v = e.currentTarget;
          // Never let anyone land further ahead than they have watched.
          if (v.currentTime > watchedSecondsRef.current + 1.2) {
            v.currentTime = watchedSecondsRef.current;
          }
        }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCurrent(v.currentTime);
          if (v.currentTime > watchedSecondsRef.current) {
            watchedSecondsRef.current = v.currentTime;
          }
          if (!v.duration || !Number.isFinite(v.duration)) return;
          const frac = Math.min(1, watchedSecondsRef.current / v.duration);
          if (frac > maxFractionRef.current) {
            maxFractionRef.current = frac;
            onProgress?.(frac);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          maxFractionRef.current = 1;
          onProgress?.(1);
        }}
      />

      {/* Big tap-to-play circle, before the first play */}
      {!hasStarted && showPlayOverlay && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label="Play the video"
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/70 via-black/30 to-black/50 text-white transition-colors hover:bg-black/40"
        >
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-28 w-28 animate-ping rounded-full bg-primary/40" />
            <span className="absolute inline-flex h-24 w-24 rounded-full bg-primary/30" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_40px_-5px_rgba(0,0,0,0.8)] ring-4 ring-white/90">
              {isReady ? (
                <Play className="h-12 w-12 translate-x-0.5 fill-current" />
              ) : (
                <Loader2 className="h-12 w-12 animate-spin" />
              )}
            </div>
          </div>
          <p className="rounded-full bg-black/70 px-4 py-1.5 text-sm font-bold tracking-wide">
            {isReady ? `TAP TO WATCH${knownClock ? ` (${knownClock})` : ''}` : 'Loading…'}
          </p>
        </button>
      )}

      {/* Tap anywhere to pause / continue (locked player only) */}
      {locked && hasStarted && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause the video' : 'Continue the video'}
          className="absolute inset-0 z-10"
        >
          {!isPlaying && !isBuffering && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-black">
                <Play className="h-8 w-8 translate-x-0.5 fill-current" />
              </span>
            </span>
          )}
        </button>
      )}

      {/* Waiting-for-network spinner */}
      {hasStarted && isBuffering && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      )}

      {/* Our own tiny control strip: nothing here can skip the video */}
      {locked && hasStarted && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2.5 pt-6">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
          </button>

          {/* Read-only progress line (no dragging on purpose) */}
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${percentWatched}%` }}
            />
          </div>

          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/90">
            {duration > 0 ? `${formatClock(remaining)} left` : '…'}
          </span>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Unlocked variant keeps the simple mute button it always had */}
      {!locked && hasStarted && autoPlay && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'}
          className="absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      )}
    </div>
  );
};

export default ExplainerVideo;
