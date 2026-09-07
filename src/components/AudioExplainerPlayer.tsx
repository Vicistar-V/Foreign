import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trackClarityEvent, ClarityEvents } from '@/lib/clarityTracking';
import { motion, AnimatePresence } from 'framer-motion';

// Audio file path - cached in browser after first load
const AUDIO_FILE_PATH = '/audio/viketa-line-explainer.mp3';

interface AudioExplainerPlayerProps {
  /** Visual variant of the player */
  variant?: 'default' | 'compact';
  /** Custom title text */
  title?: string;
  /** Custom subtitle text */
  subtitle?: string;
  /** Source for tracking context */
  trackingSource?: string;
}

// Generate static waveform bars (these are decorative, not real audio analysis)
const generateWaveformBars = (count: number, seed: number = 42) => {
  const bars: number[] = [];
  // Create a pseudo-random but consistent pattern
  for (let i = 0; i < count; i++) {
    const x = (i + seed) * 0.7;
    // Generate heights between 0.3 and 1.0 with a wave-like pattern
    const height = 0.3 + 0.7 * Math.abs(Math.sin(x * 0.5) * Math.cos(x * 0.3) + Math.sin(x * 0.15) * 0.5);
    bars.push(Math.min(1, Math.max(0.25, height)));
  }
  return bars;
};

// Pre-generate waveform bars for consistency
const WAVEFORM_BARS_DEFAULT = generateWaveformBars(35);
const WAVEFORM_BARS_COMPACT = generateWaveformBars(25);

export const AudioExplainerPlayer = ({
  variant = 'default',
  title = 'Hear How It Works',
  subtitle = 'Tap play to listen',
  trackingSource = 'unknown',
}: AudioExplainerPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Seek to position when clicking on waveform
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progressBar = progressRef.current;
    if (!audio || !progressBar || duration === 0) return;

    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }

    const rect = progressBar.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Reset finished state if seeking
    if (hasFinished) {
      setHasFinished(false);
    }
  }, [duration, hasFinished]);

  // Handle play/pause toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      trackClarityEvent(ClarityEvents.AUDIO_EXPLAINER_PAUSED);
    } else {
      // Reset if finished and playing again
      if (hasFinished) {
        audio.currentTime = 0;
        setHasFinished(false);
      }
      audio.play();
      if (!hasStartedPlaying) {
        trackClarityEvent(ClarityEvents.AUDIO_EXPLAINER_PLAYED);
        setHasStartedPlaying(true);
      }
    }
    setIsPlaying(!isPlaying);
  };

  // Handle replay
  const handleReplay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = 0;
    setCurrentTime(0);
    setHasFinished(false);
    audio.play();
    setIsPlaying(true);
    trackClarityEvent(ClarityEvents.AUDIO_EXPLAINER_PLAYED);
  };

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(duration);
      setHasFinished(true);
      trackClarityEvent(ClarityEvents.AUDIO_EXPLAINER_COMPLETED);
    };
    const handleCanPlayThrough = () => {
      setIsLoaded(true);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);

    // Preload the audio for smoother playback
    audio.load();

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [duration]);

  // Progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Get color classes based on state
  const getActiveColor = () => hasFinished ? 'bg-success' : 'bg-primary';
  const getInactiveColor = () => 'bg-muted-foreground/30';

  // Waveform bar component
  const WaveformBar = ({ 
    height, 
    index, 
    isActive, 
    isCompact 
  }: { 
    height: number; 
    index: number; 
    isActive: boolean; 
    isCompact: boolean;
  }) => {
    const baseHeight = isCompact ? 16 : 24;
    const barHeight = height * baseHeight;
    
    return (
      <motion.div
        className={`rounded-full transition-colors duration-150 ${
          isActive ? getActiveColor() : getInactiveColor()
        }`}
        style={{
          width: isCompact ? 2 : 3,
          height: barHeight,
        }}
        animate={isPlaying && isActive ? {
          scaleY: [1, 1.15, 1],
        } : {}}
        transition={{
          duration: 0.3,
          repeat: isPlaying && isActive ? Infinity : 0,
          delay: index * 0.02,
        }}
      />
    );
  };

  // Seekable waveform progress bar
  const WaveformProgress = ({ isCompact = false }: { isCompact?: boolean }) => {
    const bars = isCompact ? WAVEFORM_BARS_COMPACT : WAVEFORM_BARS_DEFAULT;
    
    return (
      <div
        ref={progressRef}
        className="relative flex items-center justify-between gap-[2px] cursor-pointer py-2 touch-none select-none"
        onClick={handleSeek}
        onTouchStart={handleSeek}
        role="slider"
        aria-label="Audio progress"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        tabIndex={0}
      >
        {bars.map((height, index) => {
          const barProgress = ((index + 1) / bars.length) * 100;
          const isActive = progress >= barProgress;
          
          return (
            <WaveformBar
              key={index}
              height={height}
              index={index}
              isActive={isActive}
              isCompact={isCompact}
            />
          );
        })}
      </div>
    );
  };

  // Compact variant for modals/drawers
  if (variant === 'compact') {
    return (
      <div className="bg-primary/10 rounded-xl p-3 border border-primary/20">
        <audio 
          ref={audioRef} 
          src={AUDIO_FILE_PATH} 
          preload="auto"
        />
        
        <div className="flex items-center gap-3">
          {/* Play/Pause/Replay Button */}
          <AnimatePresence mode="wait">
            {hasFinished ? (
              <motion.div
                key="replay"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  onClick={handleReplay}
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full bg-success/20 hover:bg-success/30 shrink-0"
                  haptic="light"
                >
                  <RotateCcw className="h-4 w-4 text-success" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  onClick={togglePlay}
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full bg-primary/20 hover:bg-primary/30 shrink-0"
                  haptic="light"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 text-primary" />
                  ) : (
                    <Play className="h-4 w-4 text-primary ml-0.5" />
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Volume2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs font-medium text-foreground truncate">
                {hasFinished ? 'Tap to replay' : title}
              </p>
            </div>
            
            {/* Seekable Waveform Progress Bar */}
            <WaveformProgress isCompact />
            
            {/* Time Display */}
            <div className="flex justify-between -mt-1">
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                {hasFinished ? 'Finished' : formatTime(currentTime)}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                {duration > 0 ? formatTime(duration) : '--:--'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default variant for dashboard
  return (
    <Card className={`overflow-hidden ${hasFinished ? 'border-success/20 bg-success/5' : 'border-primary/20 bg-primary/5'}`}>
      <CardContent className="p-3">
        <audio 
          ref={audioRef} 
          src={AUDIO_FILE_PATH} 
          preload="auto"
        />
        
        <div className="flex items-center gap-3">
          {/* Icon/Play Button Container */}
          <div className="relative">
            <AnimatePresence mode="wait">
              {hasFinished ? (
                <motion.div
                  key="replay-default"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    onClick={handleReplay}
                    size="icon"
                    variant="ghost"
                    className="h-12 w-12 rounded-full bg-success/20 hover:bg-success/30 relative z-10"
                    haptic="light"
                  >
                    <RotateCcw className="h-5 w-5 text-success" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="play-default"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    onClick={togglePlay}
                    size="icon"
                    variant="ghost"
                    className="h-12 w-12 rounded-full bg-primary/20 hover:bg-primary/30 relative z-10"
                    haptic="light"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5 text-primary" />
                    ) : (
                      <Play className="h-5 w-5 text-primary ml-0.5" />
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Pulsing ring when not playing and hasn't started */}
            {!isPlaying && !hasStartedPlaying && !hasFinished && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/50"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-center gap-2 mb-0.5">
              <Volume2 className={`h-4 w-4 shrink-0 ${hasFinished ? 'text-success' : 'text-primary'}`} />
              <p className="text-sm font-semibold text-foreground">
                {hasFinished ? 'Tap to replay' : title}
              </p>
            </div>
            
            {/* Seekable Waveform Progress Bar */}
            <WaveformProgress />
            
            {/* Time and Subtitle */}
            <div className="flex justify-between items-center -mt-1">
              <span className="text-xs text-muted-foreground">
                {hasFinished ? 'Finished - listen again?' : (hasStartedPlaying || isPlaying ? formatTime(currentTime) : subtitle)}
              </span>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                {duration > 0 ? formatTime(duration) : '--:--'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
