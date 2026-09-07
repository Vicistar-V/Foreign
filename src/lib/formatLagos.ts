// Africa/Lagos timezone helpers — single source of truth for admin timestamps.
// Uses Intl to avoid extra dependencies.

const TZ = 'Africa/Lagos';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const dateTimeLongFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const safe = (iso: string | Date | null | undefined): Date | null => {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

/** "05 Jun 2025" */
export const fmtDate = (iso: string | Date | null | undefined): string => {
  const d = safe(iso);
  return d ? dateFmt.format(d) : '—';
};

/** "05 Jun, 3:47 PM" */
export const fmtDateTime = (iso: string | Date | null | undefined): string => {
  const d = safe(iso);
  return d ? dateTimeFmt.format(d) : '—';
};

/** "05 Jun 2025, 3:47:22 PM" */
export const fmtDateTimeLong = (iso: string | Date | null | undefined): string => {
  const d = safe(iso);
  return d ? dateTimeLongFmt.format(d) : '—';
};

/** Relative time, simple: "just now", "5 min ago", "2 hr ago", "3 days ago", or full date */
export const fmtTimeAgo = (iso: string | Date | null | undefined): string => {
  const d = safe(iso);
  if (!d) return '—';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  return fmtDate(d);
};
