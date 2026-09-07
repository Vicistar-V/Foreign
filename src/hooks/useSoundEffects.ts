import { useCallback, useRef } from 'react';

type SoundType = 
  | 'ticketLock' 
  | 'scanning' 
  | 'jackpot' 
  | 'bigWin' 
  | 'win' 
  | 'refund' 
  | 'loss' 
  | 'deciding' 
  | 'buttonPress'
  // Beast Mode sounds
  | 'cycleFill'
  | 'cycleComplete'
  | 'tierUp'
  | 'pulseEvent';

// Haptic patterns (in ms): vibrate, pause, vibrate, pause...
const HAPTIC_PATTERNS: Record<SoundType, number | number[]> = {
  buttonPress: [40, 20, 60],             // Satisfying tap confirmation
  ticketLock: [50, 30, 80],              // Sharp double tap
  scanning: 30,                           // Light pulse
  deciding: [100, 100, 100],             // Heartbeat pattern
  jackpot: [50, 50, 100, 50, 150, 50, 200], // Celebration crescendo
  bigWin: [50, 50, 100, 50, 150],        // Medium celebration
  win: [50, 50, 80],                     // Happy double pulse
  refund: 40,                             // Gentle single pulse
  loss: [30, 20, 30],                    // Short buzz
  // Beast Mode haptics
  cycleFill: [50, 30, 80],               // Splash feel
  cycleComplete: [100, 50, 150, 50, 200], // Heavy celebration
  tierUp: [50, 50, 100, 100, 150],       // Ascending pattern
  pulseEvent: 20,                         // Light tap
};

export const useSoundEffects = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Trigger haptic feedback using Vibration API
  const triggerHaptic = useCallback((type: SoundType) => {
    try {
      // Check if Vibration API is supported
      if ('vibrate' in navigator) {
        const pattern = HAPTIC_PATTERNS[type];
        navigator.vibrate(pattern);
      }
    } catch (error) {
      // Silently fail - haptic is enhancement, not critical
    }
  }, []);

  const playSound = useCallback((type: SoundType) => {
    // Always trigger haptic feedback (if available)
    triggerHaptic(type);
    
    try {
      const ctx = getAudioContext();
      
      // Resume context if suspended (required for autoplay policies)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      switch (type) {
        case 'buttonPress': {
          // Satisfying "click" with a slight electronic pop
          const osc = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
          
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(800, now);
          osc2.frequency.exponentialRampToValueAtTime(500, now + 0.06);
          
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          
          osc.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc2.start(now);
          osc.stop(now + 0.1);
          osc2.stop(now + 0.1);
          break;
        }

        case 'ticketLock': {
          // Mechanical "ka-clack" sound - two quick tones with noise
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          
          filter.type = 'lowpass';
          filter.frequency.value = 2000;
          
          osc1.type = 'square';
          osc1.frequency.setValueAtTime(200, now);
          osc1.frequency.exponentialRampToValueAtTime(80, now + 0.1);
          
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(150, now);
          osc2.frequency.exponentialRampToValueAtTime(50, now + 0.15);
          
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          
          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.15);
          osc2.stop(now + 0.15);
          break;
        }

        case 'scanning': {
          // High-pitched electronic beep
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, now);
          osc.frequency.setValueAtTime(1400, now + 0.05);
          
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }

        case 'deciding': {
          // Suspenseful heartbeat-like pulse
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.value = 60;
          
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }

        case 'jackpot': {
          // Triumphant fanfare - ascending arpeggiated chord
          const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
          
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            const startTime = now + i * 0.08;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
            gain.gain.setValueAtTime(0.2, startTime + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + 0.8);
          });
          
          // Add a celebratory shimmer
          for (let j = 0; j < 5; j++) {
            const shimmer = ctx.createOscillator();
            const shimmerGain = ctx.createGain();
            
            shimmer.type = 'sine';
            shimmer.frequency.value = 2000 + Math.random() * 2000;
            
            const sTime = now + 0.4 + j * 0.1;
            shimmerGain.gain.setValueAtTime(0.08, sTime);
            shimmerGain.gain.exponentialRampToValueAtTime(0.01, sTime + 0.2);
            
            shimmer.connect(shimmerGain);
            shimmerGain.connect(ctx.destination);
            
            shimmer.start(sTime);
            shimmer.stop(sTime + 0.2);
          }
          break;
        }

        case 'bigWin': {
          // Cheerful chord progression
          const chord1 = [392, 493.88, 587.33]; // G4, B4, D5
          const chord2 = [523.25, 659.25, 783.99]; // C5, E5, G5
          
          [...chord1, ...chord2].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = i < 3 ? 'triangle' : 'sine';
            osc.frequency.value = freq;
            
            const startTime = i < 3 ? now : now + 0.2;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
            gain.gain.setValueAtTime(0.15, startTime + 0.25);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + 0.5);
          });
          break;
        }

        case 'win': {
          // Pleasant ascending two-note chime
          const notes = [523.25, 783.99]; // C5, G5
          
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = now + i * 0.12;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + 0.4);
          });
          break;
        }

        case 'refund': {
          // Soft, reassuring "ding" - single pure tone with slight shimmer
          const osc = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.value = 880; // A5
          
          osc2.type = 'sine';
          osc2.frequency.value = 1760; // A6 (octave higher, quieter)
          
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
          gain.gain.setValueAtTime(0.18, now + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          
          osc.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc2.start(now);
          osc.stop(now + 0.5);
          osc2.stop(now + 0.5);
          break;
        }

        case 'loss': {
          // Low, short "buzz" - not too harsh
          const osc = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          
          osc.type = 'sawtooth';
          osc.frequency.value = 120;
          
          osc2.type = 'square';
          osc2.frequency.value = 115;
          
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.setValueAtTime(0.15, now + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          
          osc.connect(filter);
          osc2.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc2.start(now);
          osc.stop(now + 0.25);
          osc2.stop(now + 0.25);
          break;
        }

        case 'cycleFill': {
          // Liquid splash sound - rising bubbles
          const osc = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
          
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(400, now);
          osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
          
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
          
          osc.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc2.start(now);
          osc.stop(now + 0.2);
          osc2.stop(now + 0.2);
          break;
        }

        case 'cycleComplete': {
          // Low bass growl + casino bell - triumphant!
          // Bass growl
          const bassOsc = ctx.createOscillator();
          const bassGain = ctx.createGain();
          bassOsc.type = 'sawtooth';
          bassOsc.frequency.setValueAtTime(80, now);
          bassOsc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
          bassGain.gain.setValueAtTime(0.2, now);
          bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          bassOsc.connect(bassGain);
          bassGain.connect(ctx.destination);
          bassOsc.start(now);
          bassOsc.stop(now + 0.4);

          // Casino bell chord
          const bellNotes = [880, 1108.73, 1318.51, 1760]; // A5, C#6, E6, A6
          bellNotes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            const startTime = now + 0.1 + i * 0.05;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
            gain.gain.setValueAtTime(0.12, startTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + 0.6);
          });
          break;
        }

        case 'tierUp': {
          // Level-up fanfare - ascending triumphant
          const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
          
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.value = freq;
            
            const startTime = now + i * 0.1;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + 0.4);
          });
          break;
        }

        case 'pulseEvent': {
          // Subtle network ping
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.value = 1500;
          
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        }
      }
    } catch (error) {
      // Silently fail - audio is enhancement, not critical
      console.warn('Sound effect failed:', error);
    }
  }, [getAudioContext, triggerHaptic]);

  // Play multiple scanning beeps with interval
  const playScanningSequence = useCallback((count: number = 5, interval: number = 500) => {
    for (let i = 0; i < count; i++) {
      setTimeout(() => playSound('scanning'), i * interval);
    }
  }, [playSound]);

  // Standalone haptic trigger (without sound)
  const playHapticOnly = useCallback((type: SoundType) => {
    triggerHaptic(type);
  }, [triggerHaptic]);

  return {
    playSound,
    playScanningSequence,
    playHapticOnly,
    triggerHaptic,
  };
};
