import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * First-time user tour. Walks new users through their wallet, the live
 * queue, the "Start Working" CTA, then teaches them to pick & submit a
 * task. Stops after 3 guided picks.
 *
 * Storage strategy:
 *   - Source of truth = `user_tour_progress` table on the server.
 *   - Every state change calls the `update_tour_progress` RPC.
 *   - localStorage mirrors the latest snapshot so the tour keeps working
 *     offline / on flaky connections. When the user comes back online,
 *     the snapshot gets re-synced lazily on the next state change.
 */
export type TourStep =
  | 'idle'
  | 'welcome'
  | 'wallet-withdrawable'
  | 'wallet-entry'
  | 'wallet-pending'
  | 'queue'
  | 'cta'
  | 'pick'
  | 'submit'
  | 'done';

interface TourState {
  step: TourStep;
  picksGuided: number;
}

interface TourCtx extends TourState {
  start: () => void;
  setStep: (s: TourStep) => void;
  next: () => void;
  recordPick: () => void;
  recordSubmit: () => void;
  dismiss: () => void;
}

const Ctx = createContext<TourCtx | null>(null);

const GUIDED_PICKS_TARGET = 3;
// v5 → backend-backed; bump invalidates v4 local caches.
const storageKey = (uid?: string) => `viketa:tour:v5:${uid || 'anon'}`;

const LINEAR: TourStep[] = [
  'welcome',
  'wallet-withdrawable',
  'wallet-entry',
  'wallet-pending',
  'queue',
  'cta',
];

const loadLocal = (uid?: string): TourState => {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.step === 'string') return parsed;
    }
  } catch {}
  return { step: 'idle', picksGuided: 0 };
};

const persistLocal = (uid: string | undefined, s: TourState) => {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(s));
  } catch {}
};

// Fire-and-forget RPC. We never block UI on this — backend is the
// system-of-record for admin reporting, but the UI must keep working
// even with no network.
async function syncToBackend(
  step: TourStep,
  opts: { incrementPicks?: boolean; markCompleted?: boolean } = {},
) {
  try {
    const { error } = await supabase.rpc('update_tour_progress', {
      _step: step,
      _increment_picks: opts.incrementPicks ?? false,
      _mark_completed: opts.markCompleted ?? false,
    });
    if (error) {
      // Swallow — tour must keep working offline.
      console.warn('[tour] sync failed:', error.message);
    }
  } catch (e) {
    console.warn('[tour] sync threw:', e);
  }
}

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<TourState>({ step: 'idle', picksGuided: 0 });
  const hydratedFor = useRef<string | null>(null);

  // Hydrate from server (with local fallback). Runs whenever user changes.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      setState({ step: 'idle', picksGuided: 0 });
      hydratedFor.current = null;
      return;
    }
    if (hydratedFor.current === uid) return;
    hydratedFor.current = uid;

    // Optimistic local read first so UI is instant.
    setState(loadLocal(uid));

    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_tour_progress')
          .select('current_step, picks_guided, is_completed')
          .eq('user_id', uid)
          .maybeSingle();
        if (error) {
          console.warn('[tour] load failed:', error.message);
          return;
        }
        if (!data) {
          // No row yet — first ever login; keep idle.
          const next: TourState = { step: 'idle', picksGuided: 0 };
          setState(next);
          persistLocal(uid, next);
          return;
        }
        const step = (data.is_completed ? 'done' : (data.current_step as TourStep)) || 'idle';
        const next: TourState = {
          step,
          picksGuided: Number(data.picks_guided ?? 0),
        };
        setState(next);
        persistLocal(uid, next);
      } catch (e) {
        console.warn('[tour] hydrate threw:', e);
      }
    })();
  }, [user?.id]);

  const commit = useCallback(
    (
      next: TourState,
      opts: { incrementPicks?: boolean; markCompleted?: boolean } = {},
    ) => {
      persistLocal(user?.id, next);
      if (user?.id) void syncToBackend(next.step, opts);
    },
    [user?.id],
  );

  const start = useCallback(() => {
    // Tour is temporarily disabled platform-wide. Keep the function so all
    // existing callers (Dashboard mount effect, etc.) stay no-op safe.
    return;
  }, []);

  const next = useCallback(() => {
    setState((prev) => {
      const idx = LINEAR.indexOf(prev.step);
      if (idx === -1 || idx >= LINEAR.length - 1) return prev;
      const advanced: TourState = { ...prev, step: LINEAR[idx + 1] };
      commit(advanced);
      return advanced;
    });
  }, [commit]);

  const setStep = useCallback(
    (s: TourStep) => {
      setState((prev) => {
        if (prev.step === 'done') return prev;
        const updated = { ...prev, step: s };
        commit(updated, { markCompleted: s === 'done' });
        return updated;
      });
    },
    [commit],
  );

  const recordPick = useCallback(() => {
    setState((prev) => {
      if (prev.step !== 'pick') return prev;
      const updated: TourState = { ...prev, step: 'submit' };
      commit(updated);
      return updated;
    });
  }, [commit]);

  const recordSubmit = useCallback(() => {
    setState((prev) => {
      if (prev.step !== 'submit') return prev;
      const guided = prev.picksGuided + 1;
      const completed = guided >= GUIDED_PICKS_TARGET;
      const updated: TourState = completed
        ? { step: 'done', picksGuided: guided }
        : { step: 'pick', picksGuided: guided };
      commit(updated, { incrementPicks: true, markCompleted: completed });
      return updated;
    });
  }, [commit]);

  const dismiss = useCallback(() => {
    setState((prev) => {
      const updated: TourState = { step: 'done', picksGuided: prev.picksGuided };
      commit(updated, { markCompleted: true });
      return updated;
    });
  }, [commit]);

  return (
    <Ctx.Provider value={{ ...state, start, setStep, next, recordPick, recordSubmit, dismiss }}>
      {children}
    </Ctx.Provider>
  );
};

export const useTour = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTour must be used within TourProvider');
  return c;
};
