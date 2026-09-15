import type { LabelScreenRect } from './screen-label-layout.js';
import type { LabelBudget } from './universe-label-policy.js';

export interface StableLabelCandidate {
  id: string;
  navigable: boolean;
  pinned: number;
  priority: number;
  /** Static discovery tier; camera movement must not change it. */
  tier?: number;
  shown: boolean;
  previousPlacement: number;
  /** Reserve a body's circle with its caption, as one admitted annotation. */
  anchor?: LabelScreenRect;
  placements: readonly { slot: number; rect: LabelScreenRect }[];
}

/** Reserve clear survivors before moving obstructed labels or adding newcomers.
 * The caller supplies committed history; no worker-local or gesture-phase state. */
export function admitStableLabels<T extends StableLabelCandidate>(candidates: readonly T[], budget: LabelBudget,
  clear: (candidate: T, rect: LabelScreenRect) => boolean = () => true) {
  const ordered = [...candidates].sort((a, b) => b.pinned - a.pinned || Number(b.navigable) - Number(a.navigable) ||
    (b.tier ?? 0) - (a.tier ?? 0) || Number(b.shown) - Number(a.shown) || b.priority - a.priority || a.id.localeCompare(b.id));
  const accepted: { candidate: T; placement: number; rect: LabelScreenRect }[] = [];
  const admitted = new Set<T>();
  const place = (candidate: T, previousOnly: boolean) => {
    if (admitted.has(candidate) || !budget.remaining) return;
    const previous = candidate.placements.find(item => item.slot === candidate.previousPlacement);
    const options = previousOnly ? previous ? [previous] : [] :
      [...(previous ? [previous] : []), ...candidate.placements.filter(item => item !== previous)];
    const choice = options.find(item => clear(candidate, item.rect) && budget.accepts(item.rect, candidate.anchor));
    if (!choice || !budget.admit(choice.rect, candidate.anchor)) return;
    admitted.add(candidate);
    accepted.push({ candidate, placement: choice.slot, rect: choice.rect });
  };
  // Explicit selection/hover may displace a label. Disabled captions never
  // reserve a slot ahead of a navigable object.
  for (const candidate of ordered.filter(item => item.pinned > 0)) place(candidate, false);
  for (const navigable of [true, false]) {
    const group = ordered.filter(item => item.pinned === 0 && item.navigable === navigable);
    for (const tier of [...new Set(group.map(item => item.tier ?? 0))].sort((a, b) => b - a)) {
      const peers = group.filter(item => (item.tier ?? 0) === tier);
      for (const candidate of peers) if (candidate.shown) place(candidate, true);
      for (const candidate of peers) place(candidate, false);
    }
  }
  return accepted;
}
