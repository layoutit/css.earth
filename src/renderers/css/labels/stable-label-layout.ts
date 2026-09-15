import type { LabelScreenRect } from './screen-label-layout.js';
import type { LabelBudget } from './universe-label-policy.js';

export interface StableLabelCandidate {
  id: string;
  navigable: boolean;
  pinned: number;
  priority: number;
  shown: boolean;
  previousPlacement: number;
  placements: readonly { slot: number; rect: LabelScreenRect }[];
}

/** Reserve clear survivors before moving obstructed labels or adding newcomers.
 * The caller supplies committed history; no worker-local or gesture-phase state. */
export function admitStableLabels<T extends StableLabelCandidate>(candidates: readonly T[], budget: LabelBudget,
  clear: (candidate: T, rect: LabelScreenRect) => boolean = () => true) {
  const ordered = [...candidates].sort((a, b) => b.pinned - a.pinned || Number(b.navigable) - Number(a.navigable) ||
    Number(b.shown) - Number(a.shown) || b.priority - a.priority || a.id.localeCompare(b.id));
  const accepted: { candidate: T; placement: number; rect: LabelScreenRect }[] = [];
  const admitted = new Set<T>();
  const place = (candidate: T, previousOnly: boolean) => {
    if (admitted.has(candidate) || !budget.remaining) return;
    const previous = candidate.placements.find(item => item.slot === candidate.previousPlacement);
    const options = previousOnly ? previous ? [previous] : [] :
      [...(previous ? [previous] : []), ...candidate.placements.filter(item => item !== previous)];
    const choice = options.find(item => clear(candidate, item.rect) && budget.accepts(item.rect));
    if (!choice || !budget.admit(choice.rect)) return;
    admitted.add(candidate);
    accepted.push({ candidate, placement: choice.slot, rect: choice.rect });
  };
  // Explicit selection/hover may displace a label. Disabled captions never
  // reserve a slot ahead of a navigable object.
  for (const candidate of ordered.filter(item => item.pinned > 0)) place(candidate, false);
  for (const navigable of [true, false]) {
    const group = ordered.filter(item => item.pinned === 0 && item.navigable === navigable);
    for (const candidate of group) if (candidate.shown) place(candidate, true);
    for (const candidate of group) place(candidate, false);
  }
  return accepted;
}
