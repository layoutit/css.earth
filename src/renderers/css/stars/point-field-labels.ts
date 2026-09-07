export interface PointFieldLabelPolicy {
  readonly activeSlots: number; readonly transitionSlots: number; readonly capHeightPx: number;
  readonly gapPx: number; readonly maxAlpha: number; readonly fadeMs: number;
}
export interface StarLabelCandidate {
  readonly index: number; readonly name: string; readonly x: number; readonly y: number;
  readonly radiusPx: number; readonly luminance: number; readonly magnitude: number;
}
type LabelSlot = { element: HTMLElement; index: number | null; name: string | null; fadeUntil: number };

/** Named stars retain their own projected anchor throughout admission and retirement. */
export function mountPointFieldLabels(host: HTMLElement, policy: PointFieldLabelPolicy) {
  const make = (): LabelSlot => {
    const element = host.ownerDocument.createElement('span');
    element.className = 'prepared-star-label';
    element.style.cssText = `position:absolute;left:50%;top:50%;white-space:nowrap;color:#b8c9de;font:${policy.capHeightPx / .72}px system-ui;line-height:1;opacity:0;pointer-events:none`;
    host.appendChild(element);
    return { element, index: null, name: null, fadeUntil: 0 };
  };
  const active = Array.from({ length: policy.activeSlots }, make);
  const retiring = Array.from({ length: policy.transitionSlots }, make);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  const fader = createOpacityFader(host.ownerDocument.defaultView!);
  let latest: { candidates: readonly StarLabelCandidate[]; project(index: number): StarLabelCandidate | null } | null = null;

  const clock = () => host.ownerDocument.defaultView!.performance.now();
  function writeContent(slot: LabelSlot, candidate: StarLabelCandidate) {
    if (slot.name !== candidate.name) { slot.element.textContent = candidate.name; slot.name = candidate.name; }
    slot.element.dataset.starLabelIndex = String(candidate.index);
    slot.element.style.transform = `translate(${candidate.x}px,${candidate.y - candidate.radiusPx - policy.gapPx}px) translate(-50%,-100%)`;
  }
  function write(slot: LabelSlot, candidate: StarLabelCandidate | null, retiring = false) {
    if (!candidate) {
      const remaining = Math.max(0, slot.fadeUntil - clock());
      fader.set(slot.element, 0, remaining, remaining > 0);
      if (remaining === 0) slot.fadeUntil = 0;
      return;
    }
    writeContent(slot, candidate);
    const remaining = Math.max(0, slot.fadeUntil - clock());
    fader.set(slot.element, retiring ? 0 : policy.maxAlpha * candidate.luminance, remaining, remaining > 0);
    if (remaining === 0) slot.fadeUntil = 0;
  }

  function publish(candidates: readonly StarLabelCandidate[], project: (index: number) => StarLabelCandidate | null) {
    if (destroyed) return;
    latest = { candidates, project };
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
        }
        const carriedOpacity = Number.parseFloat(slot.element.style.opacity);
        fader.set(departure.element, Number.isFinite(carriedOpacity) ? carriedOpacity : 0);
        departure.fadeUntil = clock() + policy.fadeMs;
        fader.set(departure.element, 0, policy.fadeMs);
        slot.index = null; fader.set(slot.element, 0);
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
        if (latest) publish(latest.candidates, latest.project);
      }, policy.fadeMs);
    }
    for (const slot of active) write(slot, slot.index === null ? null : project(slot.index));
    for (const slot of retiring) write(slot, slot.index === null ? null : project(slot.index), true);
  }
  return Object.freeze({ publish,
    destroy() { destroyed = true; latest = null; if (timer !== null) clearTimeout(timer); fader.destroy(); for (const slot of [...active, ...retiring]) slot.element.remove(); },
  });
}
import { createOpacityFader } from './opacity-fader.js';
