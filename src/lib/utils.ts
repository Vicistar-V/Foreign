import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLagos(date: Date | string | number, pattern: string) {
  // Use Intl to get the date in Lagos timezone, then format it
  const d = new Date(date);
  const lagosDate = new Date(d.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  return format(lagosDate, pattern);
}
