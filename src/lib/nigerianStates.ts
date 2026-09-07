// 36 states of Nigeria + FCT (Abuja). Ordered for search + analytics.
// Grouped by geopolitical zone so we can slice ads by region later.

export type NigerianZone =
  | 'North-Central'
  | 'North-East'
  | 'North-West'
  | 'South-East'
  | 'South-South'
  | 'South-West';

export interface NigerianState {
  name: string;
  zone: NigerianZone;
}

export const NIGERIAN_STATES: NigerianState[] = [
  // North-Central
  { name: 'FCT (Abuja)', zone: 'North-Central' },
  { name: 'Benue', zone: 'North-Central' },
  { name: 'Kogi', zone: 'North-Central' },
  { name: 'Kwara', zone: 'North-Central' },
  { name: 'Nasarawa', zone: 'North-Central' },
  { name: 'Niger', zone: 'North-Central' },
  { name: 'Plateau', zone: 'North-Central' },
  // North-East
  { name: 'Adamawa', zone: 'North-East' },
  { name: 'Bauchi', zone: 'North-East' },
  { name: 'Borno', zone: 'North-East' },
  { name: 'Gombe', zone: 'North-East' },
  { name: 'Taraba', zone: 'North-East' },
  { name: 'Yobe', zone: 'North-East' },
  // North-West
  { name: 'Jigawa', zone: 'North-West' },
  { name: 'Kaduna', zone: 'North-West' },
  { name: 'Kano', zone: 'North-West' },
  { name: 'Katsina', zone: 'North-West' },
  { name: 'Kebbi', zone: 'North-West' },
  { name: 'Sokoto', zone: 'North-West' },
  { name: 'Zamfara', zone: 'North-West' },
  // South-East
  { name: 'Abia', zone: 'South-East' },
  { name: 'Anambra', zone: 'South-East' },
  { name: 'Ebonyi', zone: 'South-East' },
  { name: 'Enugu', zone: 'South-East' },
  { name: 'Imo', zone: 'South-East' },
  // South-South
  { name: 'Akwa Ibom', zone: 'South-South' },
  { name: 'Bayelsa', zone: 'South-South' },
  { name: 'Cross River', zone: 'South-South' },
  { name: 'Delta', zone: 'South-South' },
  { name: 'Edo', zone: 'South-South' },
  { name: 'Rivers', zone: 'South-South' },
  // South-West
  { name: 'Ekiti', zone: 'South-West' },
  { name: 'Lagos', zone: 'South-West' },
  { name: 'Ogun', zone: 'South-West' },
  { name: 'Ondo', zone: 'South-West' },
  { name: 'Osun', zone: 'South-West' },
  { name: 'Oyo', zone: 'South-West' },
];

// Sorted alphabetically for the picker
export const NIGERIAN_STATES_ALPHA: NigerianState[] = [...NIGERIAN_STATES].sort(
  (a, b) => a.name.localeCompare(b.name),
);

export const STATE_NAMES: string[] = NIGERIAN_STATES_ALPHA.map((s) => s.name);

export const zoneForState = (name: string | null | undefined): NigerianZone | null => {
  if (!name) return null;
  const found = NIGERIAN_STATES.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return found?.zone ?? null;
};

export const isValidState = (name: string | null | undefined): boolean =>
  !!name && NIGERIAN_STATES.some((s) => s.name.toLowerCase() === name.toLowerCase());
