import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Film, Upload, Trash2, CheckCircle2, AlertTriangle, Loader2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformConfig } from '@/hooks/usePlatformConfig';
import { ExplainerVideo } from '@/components/ExplainerVideo';

const BUCKET = 'explainer-video';
/** Signed links live ~10 years, so the video never goes dark on its own. */
const LINK_LIFETIME_SECONDS = 315_360_000;
/** Anything bigger than this will punish people on slow phones. */
const MAX_BYTES = 60 * 1024 * 1024;

type Stage = 'idle' | 'reading' | 'poster' | 'uploading' | 'saving';

const STAGE_TEXT: Record<Stage, string> = {
  idle: '',
  reading: 'Checking the video…',
  poster: 'Making the cover picture…',
  uploading: 'Sending the video up…',
  saving: 'Saving the settings…',
};

const humanSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

const clock = (secs: number) => {
  const total = Math.round(secs);
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} sec`;
};

interface Probe {
  duration: number;
  width: number;
  height: number;
}

/** Ask the browser how long the video is and what shape it has. */
const probeVideo = (file: File) =>
  new Promise<Probe>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => URL.revokeObjectURL(url);
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('This phone/browser could not read the video. Try an MP4 file.'));
    }, 20_000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const probe: Probe = {
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        width: video.videoWidth,
        height: video.videoHeight,
      };
      cleanup();
      if (!probe.duration || !probe.width || !probe.height) {
        reject(new Error('This file does not look like a playable video.'));
        return;
      }
      resolve(probe);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('This video type cannot play in browsers. Please use MP4 (H.264).'));
    };
    video.src = url;
  });

/** Grab one frame as the cover picture. Optional — never blocks the upload. */
const grabPoster = (file: File, at: number) =>
  new Promise<Blob | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const done = (blob: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    const timer = window.setTimeout(() => done(null), 20_000);

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return done(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            window.clearTimeout(timer);
            done(blob);
          },
          'image/jpeg',
          0.75,
        );
      } catch {
        window.clearTimeout(timer);
        done(null);
      }
    };
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(at, Math.max(0, (video.duration || 1) - 0.1));
      } catch {
        done(null);
      }
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done(null);
    };
    video.src = url;
  });

/**
 * Lets an admin drop in the video that plays on the "watch this first" screen.
 * The shape, the length and the cover picture are all worked out by the system
 * — the admin only picks the file.
 */
export const ExplainerVideoUploader = () => {
  const queryClient = useQueryClient();
  const { data: config } = usePlatformConfig();
  const cfg = (config ?? {}) as Record<string, any>;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');

  const savedUrl = (cfg.explainer_video_url as string | null) ?? '';
  const savedDuration = Number(cfg.explainer_video_duration_seconds) || 0;
  const savedAspect = Number(cfg.explainer_video_aspect) || 0;
  const savedPercent = Number(cfg.explainer_video_required_percent);
  const requiredPercent = Number.isFinite(savedPercent) ? savedPercent : 90;

  const [percentInput, setPercentInput] = useState(String(requiredPercent));
  const [percentTouched, setPercentTouched] = useState(false);
  useEffect(() => {
    if (!percentTouched) setPercentInput(String(requiredPercent));
  }, [requiredPercent, percentTouched]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setStage('reading');
      if (!file.type.startsWith('video/')) {
        throw new Error('That is not a video file.');
      }
      if (file.size > MAX_BYTES) {
        throw new Error(
          `That file is ${humanSize(file.size)}. Please keep it under 60 MB so it opens fast on small phones.`,
        );
      }

      const probe = await probeVideo(file);

      setStage('poster');
      const poster = await grabPoster(file, Math.min(1.2, probe.duration / 2));

      setStage('uploading');
      const stamp = Date.now();
      const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
      const videoPath = `watch-first/video-${stamp}.${ext}`;
      const posterPath = `watch-first/cover-${stamp}.jpg`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(videoPath, file, { contentType: file.type || 'video/mp4', upsert: true });
      if (upErr) throw new Error(upErr.message);

      let posterUrl = '';
      if (poster) {
        const { error: posterErr } = await supabase.storage
          .from(BUCKET)
          .upload(posterPath, poster, { contentType: 'image/jpeg', upsert: true });
        if (!posterErr) {
          const { data: signedPoster } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(posterPath, LINK_LIFETIME_SECONDS);
          posterUrl = signedPoster?.signedUrl ?? '';
        }
      }

      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(videoPath, LINK_LIFETIME_SECONDS);
      if (signErr || !signed?.signedUrl) {
        // Roll back the orphan file so storage never fills up with junk.
        await supabase.storage.from(BUCKET).remove([videoPath, posterPath]);
        throw new Error(signErr?.message || 'Could not create the playing link.');
      }

      setStage('saving');
      const oldVideoPath = (cfg.explainer_video_path as string | null) ?? '';
      const oldPosterPath = (cfg.explainer_video_poster_path as string | null) ?? '';

      const { error: cfgErr } = await supabase
        .from('platform_config')
        .update({
          explainer_video_url: signed.signedUrl,
          explainer_video_path: videoPath,
          explainer_video_poster_url: posterUrl || null,
          explainer_video_poster_path: posterUrl ? posterPath : null,
          explainer_video_aspect: probe.width / probe.height,
          explainer_video_duration_seconds: Math.round(probe.duration * 100) / 100,
          explainer_video_updated_at: new Date().toISOString(),
        } as any)
        .eq('id', 1);
      if (cfgErr) {
        await supabase.storage.from(BUCKET).remove([videoPath, posterPath]);
        throw new Error(cfgErr.message);
      }

      // Old files are no longer needed — best effort, failures don't matter.
      const stale = [oldVideoPath, oldPosterPath].filter((p) => p && p !== videoPath && p !== posterPath);
      if (stale.length) await supabase.storage.from(BUCKET).remove(stale).catch?.(() => {});

      return {
        url: signed.signedUrl,
        posterUrl,
        aspect: probe.width / probe.height,
        duration: probe.duration,
      };
    },
    onSuccess: (result) => {
      // Show it everywhere straight away, no waiting for a refetch.
      queryClient.setQueryData(['platform-config'], (old: any) =>
        old
          ? {
              ...old,
              explainer_video_url: result.url,
              explainer_video_poster_url: result.posterUrl || null,
              explainer_video_aspect: result.aspect,
              explainer_video_duration_seconds: result.duration,
            }
          : old,
      );
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      setStage('idle');
      toast.success('New video is live', {
        description: `Everyone opening the "watch this first" page now sees it (${clock(result.duration)}).`,
      });
    },
    onError: (error: Error) => {
      setStage('idle');
      toast.error('Video not saved', { description: error.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const paths = [cfg.explainer_video_path, cfg.explainer_video_poster_path].filter(Boolean) as string[];
      const { error } = await supabase
        .from('platform_config')
        .update({
          explainer_video_url: null,
          explainer_video_path: null,
          explainer_video_poster_url: null,
          explainer_video_poster_path: null,
          explainer_video_aspect: null,
          explainer_video_duration_seconds: null,
          explainer_video_updated_at: new Date().toISOString(),
        } as any)
        .eq('id', 1);
      if (error) throw error;
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    },
    onMutate: () => {
      const previous = queryClient.getQueryData(['platform-config']);
      queryClient.setQueryData(['platform-config'], (old: any) =>
        old ? { ...old, explainer_video_url: null, explainer_video_poster_url: null } : old,
      );
      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('Back to the built-in video');
    },
    onError: (error: Error, _v, context: any) => {
      if (context?.previous) queryClient.setQueryData(['platform-config'], context.previous);
      toast.error('Could not remove it', { description: error.message });
    },
  });

  const savePercentMutation = useMutation({
    mutationFn: async (percent: number) => {
      const { error } = await supabase
        .from('platform_config')
        .update({ explainer_video_required_percent: percent } as any)
        .eq('id', 1);
      if (error) throw error;
      return percent;
    },
    onMutate: (percent: number) => {
      const previous = queryClient.getQueryData(['platform-config']);
      queryClient.setQueryData(['platform-config'], (old: any) =>
        old ? { ...old, explainer_video_required_percent: percent } : old,
      );
      return { previous };
    },
    onSuccess: () => {
      setPercentTouched(false);
      queryClient.invalidateQueries({ queryKey: ['platform-config'] });
      toast.success('Watch amount saved');
    },
    onError: (error: Error, _v, context: any) => {
      if (context?.previous) queryClient.setQueryData(['platform-config'], context.previous);
      toast.error('Could not save', { description: error.message });
    },
  });

  const busy = uploadMutation.isPending;

  return (
    <Card className="border-2 overflow-hidden">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Film className="h-5 w-5 text-primary" />
          "Watch This First" Video
        </CardTitle>
        <CardDescription>
          The video every new person must watch before they can sign up
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={savedUrl ? 'success' : 'outline'} className="uppercase text-[10px] tracking-wider">
            {savedUrl ? 'Your video' : 'Built-in video'}
          </Badge>
          {savedDuration > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">Plays for {clock(savedDuration)}</span>
          )}
          {savedAspect > 0 && (
            <span className="text-xs text-muted-foreground">
              {savedAspect < 0.95 ? 'Tall (phone) video' : savedAspect > 1.15 ? 'Wide video' : 'Square video'}
            </span>
          )}
        </div>

        {/* Live preview — exactly what people see, locked player and all */}
        <div className="mx-auto w-full max-w-[220px]">
          <ExplainerVideo key={savedUrl || 'built-in'} />
        </div>

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) uploadMutation.mutate(file);
            }}
          />
          <Button
            className="h-12 w-full font-semibold"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            haptic="medium"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? STAGE_TEXT[stage] : savedUrl ? 'Upload a different video' : 'Upload your video'}
          </Button>

          {savedUrl && (
            <Button
              variant="ghost"
              className="h-10 w-full text-destructive hover:text-destructive"
              onClick={() => removeMutation.mutate()}
              disabled={busy || removeMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Remove it and use the built-in video
            </Button>
          )}
        </div>

        {/* How much must be watched */}
        <div className="space-y-2 rounded-xl border bg-card/50 p-4">
          <Label htmlFor="watch-percent" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Must watch at least
          </Label>
          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              <Input
                id="watch-percent"
                type="number"
                min={50}
                max={100}
                value={percentInput}
                onChange={(e) => {
                  setPercentTouched(true);
                  setPercentInput(e.target.value);
                }}
                className="h-11 pr-8 text-lg font-medium tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            <Button
              className="h-11 px-6"
              onClick={() => {
                const n = parseInt(percentInput, 10);
                if (!Number.isFinite(n) || n < 50 || n > 100) {
                  toast.error('Pick a number between 50 and 100');
                  return;
                }
                savePercentMutation.mutate(n);
              }}
              disabled={savePercentMutation.isPending || parseInt(percentInput, 10) === requiredPercent}
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            The "Continue to sign up" button stays locked until the person has watched this much.
          </p>
        </div>

        {/* Plain-words help */}
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Use an <strong>MP4</strong> file recorded with a phone or exported from any editor. Keep it under{' '}
              <strong>60 MB</strong> so it starts playing straight away on cheap phones and small data.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <span>
              You do not need to tell us the shape or the length — the system reads that from the file and the page
              fits itself around it. A cover picture is also taken from the video automatically.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              People cannot drag the video forward, download it, or jump to the end. If the video ever fails to play on
              someone's phone, the page lets them carry on after a short wait so nobody gets stuck.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExplainerVideoUploader;
