/** Journey/profile qualification is explicit; experimental recordings never enter the default gate. */
import { journey as milkyWay } from './milky-way.journey.mts';
import { journey as earthSystem } from './earth-system.journey.mts';
import { journey as dione } from './dione.journey.mts';
import { journey as lightCurves } from './light-curves.journey.mts';
import { journeys as representatives } from './representatives.journey.mts';
import { journeys as core } from './core.journey.mts';
import { profiles } from './harness/profiles.mts';
import type { Journey } from './harness/api.mts';
export type Status = 'qualified' | 'experimental';
export interface RegisteredJourney extends Journey { status: Record<string, Status> }
// Measured ten exact plus thirty further captures; native request/readiness drift stays experimental.
const qualified: Record<string, readonly string[]> = {
  "chromium-desktop": ["lmc", "milky-way", "earth-system", "dione", "milky-way-deep-link", "dione-deep-link", "dione-interrupted", "dione-drag", "dione-keyboard"],
  "webkit-desktop": ["lmc", "milky-way", "earth-system", "dione", "milky-way-deep-link", "earth-system-deep-link", "dione-deep-link", "dione-interrupted", "dione-drag", "dione-keyboard"],
};
export const journeys: RegisteredJourney[] = [milkyWay, earthSystem, dione, lightCurves, ...core, ...representatives].map(journey => ({
  ...journey, status: Object.fromEntries(Object.keys(profiles).map(profile => [profile, qualified[profile]?.includes(journey.id) ? 'qualified' : 'experimental'])),
}));
export function selectJourneys(profile: string, requested?: string, gate = false): RegisteredJourney[] {
  if (!profiles[profile]) throw new Error(`Unknown profile ${profile}`);
  const ids = requested?.split(',');
  if (ids?.some(id => !journeys.some(journey => journey.id === id))) throw new Error('Unknown requested journey');
  const selected = journeys.filter(journey => ids ? ids.includes(journey.id) : journey.status[profile] === 'qualified');
  if (!selected.length) throw new Error('No qualified journeys for this profile; explicitly select an experimental journey');
  if (gate && selected.some(journey => journey.status[profile] !== 'qualified')) throw new Error('Gate refuses experimental journey/profile pairs');
  return selected;
}
