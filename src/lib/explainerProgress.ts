export const explainerSeenKey = (userId?: string) => `viketa:explainer_seen:${userId || 'anon'}`;

export const markExplainerSeenLocally = (userId?: string) => {
  try {
    localStorage.setItem(explainerSeenKey(userId), String(Date.now()));
  } catch {
    return;
  }
};

export const hasRecentExplainerCompletion = (userId?: string) => {
  try {
    const raw = localStorage.getItem(explainerSeenKey(userId));
    if (!raw) return false;
    return Date.now() - Number(raw) < 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};