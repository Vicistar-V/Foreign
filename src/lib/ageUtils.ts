/**
 * Estimate a user's age (in whole years) from birth_year and birth_month,
 * relative to today. Month is optional; when missing we use January.
 */
export function estimateAge(
  birthYear?: number | null,
  birthMonth?: number | null,
): number | null {
  if (!birthYear || birthYear < 1900) return null;
  const now = new Date();
  const month = birthMonth && birthMonth >= 1 && birthMonth <= 12 ? birthMonth : 1;
  // Assume mid-month (day 15) so the age "estimate" never jitters around month edges.
  const birth = new Date(birthYear, month - 1, 15);
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age < 0 || age > 130 ? null : age;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatBirthDisplay(
  birthYear?: number | null,
  birthMonth?: number | null,
): string | null {
  if (!birthYear) return null;
  if (birthMonth && birthMonth >= 1 && birthMonth <= 12) {
    return `${MONTH_NAMES[birthMonth - 1]} ${birthYear}`;
  }
  return String(birthYear);
}
