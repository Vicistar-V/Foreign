// Keeps the current Moniepoint payment attempt reflected in the URL as
// `?pay=<attempt_id>` so a reload / back navigation restores the same
// payment screen instead of forcing the user to start over.

export const PAY_QUERY_PARAM = 'pay';

export function setPayUrlParam(attemptId: string) {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(PAY_QUERY_PARAM) === attemptId) return;
    url.searchParams.set(PAY_QUERY_PARAM, attemptId);
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // no-op
  }
}

export function clearPayUrlParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PAY_QUERY_PARAM)) return;
    url.searchParams.delete(PAY_QUERY_PARAM);
    const qs = url.searchParams.toString();
    const next = url.pathname + (qs ? `?${qs}` : '') + url.hash;
    window.history.replaceState(window.history.state, '', next);
  } catch {
    // no-op
  }
}

export function readPayUrlParam(): string | null {
  try {
    return new URL(window.location.href).searchParams.get(PAY_QUERY_PARAM);
  } catch {
    return null;
  }
}
