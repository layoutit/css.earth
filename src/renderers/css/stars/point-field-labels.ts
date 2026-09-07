import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';

export interface PointFieldLabelPolicy {
  readonly activeSlots: number; readonly transitionSlots: number; readonly capHeightPx: number;
  readonly gapPx: number; readonly maxAlpha: number; readonly fadeMs: number;
}
export interface StarLabelCandidate {
  readonly index: number; readonly name: string; readonly x: number; readonly y: number;
  readonly radiusPx: number; readonly luminance: number; readonly magnitude: number;
}
type LabelSlot = {
  element: HTMLElement; index: number | null; name: string | null; fadeUntil: number;
  widthPx: number; heightPx: number; bounds: LabelScreenRect | null; magnitude: number;
  accepted: boolean; nominalAlpha: number;
};

/** Named stars retain their own projected anchor throughout admission and retirement. */
export function mountPointFieldLabels(host: HTMLElement, policy: PointFieldLabelPolicy) {
  const make = (): LabelSlot => {
    const element = host.ownerDocument.createElement('span');
    element.className = 'prepared-star-label';
    element.style.cssText = `position:absolute;left:50%;top:50%;white-space:nowrap;color:#b8c9de;font:${policy.capHeightPx / .72}px system-ui;line-height:1;opacity:0;pointer-events:none`;
    host.appendChild(element);
    return { element, index: null, name: null, fadeUntil: 0, widthPx: 0, heightPx: 0, bounds: null, magnitude: Infinity,
      accepted: false, nominalAlpha: 0 };
  };
  const active = Array.from({ length: policy.activeSlots }, make);
  const retiring = Array.from({ length: policy.transitionSlots }, make);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  const fader = createOpacityFader(host.ownerDocument.defaultView!);
  let latest: { candidates: readonly StarLabelCandidate[]; project(index: number): StarLabelCandidate | null;
    exclusions: readonly LabelScreenRect[] } | null = null;

  const clock = () => host.ownerDocument.defaultView!.performance.now();
  function writeContent(slot: LabelSlot, candidate: StarLabelCandidate) {
    const changed = slot.name !== candidate.name;
    if (changed) {
      slot.element.textContent = candidate.name; slot.name = candidate.name;
    }
    if (changed || slot.widthPx <= 0 || slot.heightPx <= 0) {
      // Cache actual text layout; retry if its host had no layout during admission.
      slot.widthPx = slot.element.offsetWidth; slot.heightPx = slot.element.offsetHeight;
    }
    slot.element.dataset.starLabelIndex = String(candidate.index);
    const bottom = candidate.y - candidate.radiusPx - policy.gapPx;
    slot.element.style.transform = `translate(${candidate.x}px,${bottom}px) translate(-50%,-100%)`;
    slot.bounds = slot.widthPx > 0 && slot.heightPx > 0 ? {
      left: candidate.x - slot.widthPx / 2, right: candidate.x + slot.widthPx / 2,
      top: bottom - slot.heightPx, bottom,
    } : null;
    slot.magnitude = candidate.magnitude;
  }
  function write(slot: LabelSlot, candidate: StarLabelCandidate | null) {
    if (candidate) writeContent(slot, candidate);
    slot.nominalAlpha = candidate ? policy.maxAlpha * candidate.luminance : 0;
  }

  function publish(candidates: readonly StarLabelCandidate[], project: (index: number) => StarLabelCandidate | null,
    exclusions: readonly LabelScreenRect[] = []) {
    if (destroyed) return;
    latest = { candidates, project, exclusions };
    if (timer === null) {
      const winners = [...candidates].sort((a, b) => a.magnitude - b.magnitude || a.index - b.index).slice(0, active.length);
      const selected = new Set(winners.map(candidate => candidate.index));
      let retireCount = 0;
      for (const slot of active) {
        if (slot.index === null || selected.has(slot.index)) continue;
        const departure = retiring[retireCount++];
        departure.index = slot.index;
        const candidate = project(slot.index);
        if (candidate) writeContent(departure, candidate);
        else {
          departure.name = slot.name;
          departure.element.textContent = slot.element.textContent;
          departure.element.dataset.starLabelIndex = slot.element.dataset.starLabelIndex ?? '';
          departure.element.style.transform = slot.element.style.transform;
          departure.widthPx = slot.widthPx; departure.heightPx = slot.heightPx;
          departure.bounds = slot.bounds; departure.magnitude = slot.magnitude;
        }
        const carriedOpacity = Number.parseFloat(slot.element.style.opacity);
        fader.set(departure.element, Number.isFinite(carriedOpacity) ? carriedOpacity : 0);
        departure.accepted = false;
        departure.fadeUntil = clock() + policy.fadeMs;
        fader.set(departure.element, 0, policy.fadeMs);
        slot.index = null; slot.accepted = false; fader.set(slot.element, 0);
      }
      for (const candidate of winners) {
        if (active.some(slot => slot.index === candidate.index)) continue;
        const slot = active.find(slot => slot.index === null)!;
        slot.index = candidate.index;
        slot.fadeUntil = clock() + policy.fadeMs;
        fader.set(slot.element, 0);
      }
      if (retireCount > 0) timer = setTimeout(() => {
        timer = null;
        for (const slot of retiring) { slot.index = null; slot.fadeUntil = 0; fader.set(slot.element, 0); }
        if (latest) publish(latest.candidates, latest.project, latest.exclusions);
      }, policy.fadeMs);
    }
    for (const slot of active) write(slot, slot.index === null ? null : project(slot.index));
    for (const slot of retiring) write(slot, slot.index === null ? null : project(slot.index));
    // Settle collision priority immediately, but animate the existing label opacity.
    // Reversals get a fresh deadline; ordinary camera publications keep it unchanged.
    const occupied = [...exclusions];
    const byBrightness = (a: LabelSlot, b: LabelSlot) => a.magnitude - b.magnitude || (a.index ?? 0) - (b.index ?? 0);
    for (const slot of [...active].sort(byBrightness).concat([...retiring].sort(byBrightness))) {
      const blocked = slot.index === null || !slot.bounds || occupied.some(rect => labelRectsOverlap(slot.bounds!, rect));
      const accepted = !blocked && !retiring.includes(slot) && slot.nominalAlpha > 0;
      const changed = slot.accepted !== accepted;
      if (changed) slot.fadeUntil = clock() + policy.fadeMs;
      slot.accepted = accepted;
      const remaining = Math.max(0, slot.fadeUntil - clock());
      fader.set(slot.element, accepted ? slot.nominalAlpha : 0, remaining, !changed && remaining > 0);
      if (remaining === 0) slot.fadeUntil = 0;
      // A blocked retained label becomes unpainted at alpha0, never via a hard hide.
      slot.element.style.visibility = slot.index === null || !slot.bounds ? 'hidden' : '';
      if (!blocked && (accepted || (retiring.includes(slot) && Number(slot.element.style.opacity) > 0))) occupied.push(slot.bounds!);
    }
  }
  return Object.freeze({ publish,
    destroy() { destroyed = true; latest = null; if (timer !== null) clearTimeout(timer); fader.destroy(); for (const slot of [...active, ...retiring]) slot.element.remove(); },
  });
}
import { createOpacityFader } from './opacity-fader.js';
