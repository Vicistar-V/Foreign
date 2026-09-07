import { usePlatformConfig } from './usePlatformConfig';

/** Video that ships inside the app — used until an admin uploads their own. */
export const BUILT_IN_VIDEO = '/video/explainer.mp4';
export const BUILT_IN_POSTER = '/video/explainer-poster.jpg';

export interface ExplainerVideoSettings {
  /** Web address of the video people should watch. */
  videoUrl: string;
  /** Still picture shown before play. Empty string means "no picture". */
  posterUrl: string;
  /** Shape of the video (width divided by height). 0 when we don't know yet. */
  aspect: number;
  /** How long it plays, in seconds. 0 when we don't know yet. */
  durationSeconds: number;
  /** How much of it a person must watch before they can move on (0..1). */
  requiredFraction: number;
  /** True when the video came from an admin upload (not the built-in one). */
  isCustom: boolean;
  /** Still loading the settings from the database. */
  isLoading: boolean;
}

/**
 * One place that answers: "which video do we play, and how much of it must
 * people watch?". Admin uploads win; otherwise we fall back to the video that
 * ships with the app, so this NEVER returns an empty player.
 */
export const useExplainerVideoSettings = (): ExplainerVideoSettings => {
  const { data, isLoading } = usePlatformConfig();
  const config = (data ?? {}) as Record<string, any>;

  const uploaded = typeof config.explainer_video_url === 'string' ? config.explainer_video_url.trim() : '';
  const uploadedPoster =
    typeof config.explainer_video_poster_url === 'string' ? config.explainer_video_poster_url.trim() : '';

  const isCustom = !!uploaded;
  const rawPercent = Number(config.explainer_video_required_percent);
  const percent = Number.isFinite(rawPercent) ? Math.min(100, Math.max(50, rawPercent)) : 90;

  const rawAspect = Number(config.explainer_video_aspect);
  const rawDuration = Number(config.explainer_video_duration_seconds);

  return {
    videoUrl: isCustom ? uploaded : BUILT_IN_VIDEO,
    posterUrl: isCustom ? uploadedPoster : BUILT_IN_POSTER,
    aspect: isCustom && Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : isCustom ? 0 : 9 / 16,
    durationSeconds: isCustom && Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0,
    requiredFraction: percent / 100,
    isCustom,
    isLoading,
  };
};
