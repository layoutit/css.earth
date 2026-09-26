import { labelRectsOverlap, type LabelScreenRect } from './screen-label-layout.js';
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
  const place = (candidate: T, previousOnly: boolean, peers: readonly T[] = []) => {
    if (admitted.has(candidate) || !budget.remaining) return;
    const previous = candidate.placements.find(item => item.slot === candidate.previousPlacement);
    const options = [...(previous ? [previous] : []), ...candidate.placements.filter(item => item !== previous)]
      .filter(item => clear(candidate, item.rect) && budget.accepts(item.rect, candidate.anchor));
    if (!options.length) return;
    // A movable caption must not needlessly cover another body's fixed circle.
    // Only consider peers that can still fit; co-located circles and exhausted
    // slots cannot be rescued by moving text. Prefer the committed side among
    // equally clear options, and retain normal priority when no side clears all.
    const anchors = budget.remaining > 1 ? peers.filter(peer => peer !== candidate && !admitted.has(peer) && peer.anchor &&
      (!candidate.anchor || !labelRectsOverlap(candidate.anchor, peer.anchor)) &&
      peer.placements.some(item => clear(peer, item.rect) && budget.accepts(item.rect, peer.anchor)))
      .map(peer => peer.anchor!) : [];
    const choice = options.find(item => anchors.every(anchor => !labelRectsOverlap(item.rect, anchor))) ?? options[0];
    if (previousOnly && choice !== previous) return;
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
      for (const candidate of peers) if (candidate.shown) place(candidate, true, peers);
      for (const candidate of peers) place(candidate, false, peers);
    }
  }
  return accepted;
}
