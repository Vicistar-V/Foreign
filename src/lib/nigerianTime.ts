/**
 * Nigerian Time (WAT - West Africa Time, UTC+1) Utility Functions
 * 
 * These functions ensure consistent timezone handling across the application
 * by always using Africa/Lagos timezone for date calculations.
 */

/**
 * Get current date in Nigerian timezone (YYYY-MM-DD format)
 */
export const getNigerianDate = (): string => {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Get current datetime as Date object in Nigerian timezone
 */
export const getNigerianDateTime = (): Date => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
};

/**
 * Check if a given date string represents today in Nigerian timezone
 */
export const isNigerianToday = (dateString: string): boolean => {
  const nigerianNow = getNigerianDateTime();
  const compareDate = new Date(new Date(dateString).toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  return nigerianNow.toDateString() === compareDate.toDateString();
};

/**
 * Check if a given date is within this week in Nigerian timezone
 */
export const isNigerianThisWeek = (dateString: string): boolean => {
  const nigerianNow = getNigerianDateTime();
  const compareDate = new Date(new Date(dateString).toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  
  // Get start of week (Monday) in Nigerian timezone
  const startOfWeek = new Date(nigerianNow);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);
  
  return compareDate >= startOfWeek && compareDate <= nigerianNow;
};

/**
 * Check if a given date is within this month in Nigerian timezone
 */
export const isNigerianThisMonth = (dateString: string): boolean => {
  const nigerianNow = getNigerianDateTime();
  const compareDate = new Date(new Date(dateString).toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
  
  return nigerianNow.getFullYear() === compareDate.getFullYear() &&
         nigerianNow.getMonth() === compareDate.getMonth();
};

/**
 * Convert a date string to Nigerian timezone Date object
 */
export const toNigerianDate = (dateString: string): Date => {
  const date = new Date(dateString);
  return new Date(date.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
};

/**
 * Format a date in Nigerian timezone (e.g., "Jan 15, 2024")
 */
export const formatNigerianDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format time in Nigerian timezone (e.g., "2:30 PM")
 */
export const formatNigerianTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format full datetime in Nigerian timezone (e.g., "Jan 15, 2024 at 2:30 PM")
 */
export const formatNigerianDateTime = (dateString: string): string => {
  return `${formatNigerianDate(dateString)} at ${formatNigerianTime(dateString)}`;
};

/**
 * Format datetime with full month in Nigerian timezone (e.g., "January 15, 2024")
 */
export const formatNigerianDateLong = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format datetime for displays (e.g., "Jan 15, 2:30 PM")
 */
export const formatNigerianDateTimeShort = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    timeZone: 'Africa/Lagos',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Calculate relative time from now in Nigerian timezone (e.g., "2 hours ago")
 */
export const formatNigerianRelativeTime = (dateString: string): string => {
  const nigerianNow = getNigerianDateTime();
  const compareDate = toNigerianDate(dateString);
  const diffMs = nigerianNow.getTime() - compareDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  
  return formatNigerianDate(dateString);
};

/**
 * Check if a date is within the last N days in Nigerian timezone
 */
export const isNigerianWithinDays = (dateString: string, days: number): boolean => {
  const nigerianNow = getNigerianDateTime();
  const compareDate = toNigerianDate(dateString);
  const daysAgo = new Date(nigerianNow);
  daysAgo.setDate(daysAgo.getDate() - days);
  daysAgo.setHours(0, 0, 0, 0);
  
  return compareDate >= daysAgo && compareDate <= nigerianNow;
};

/**
 * Check if a date is within a custom range in Nigerian timezone
 */
export const isNigerianInRange = (dateString: string, startDate: Date, endDate: Date): boolean => {
  const compareDate = toNigerianDate(dateString);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  return compareDate >= start && compareDate <= end;
};

/**
 * Get date N days ago in Nigerian timezone
 */
export const getNigerianDaysAgo = (days: number): Date => {
  const nigerianNow = getNigerianDateTime();
  const daysAgo = new Date(nigerianNow);
  daysAgo.setDate(daysAgo.getDate() - days);
  daysAgo.setHours(0, 0, 0, 0);
  return daysAgo;
};
