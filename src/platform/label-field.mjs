// Captions for far-view bodies: which labels are drawn, where, and how they
// give way to one another. A port of the reference engine's label pass
// (galaxio `labels/labelDeclutter.ts`, `labels/labelField.ts` and the body
// caption side of `scene/solarSystemPasses.ts`) as pure data logic; the DOM
// side lives in heliocentric-view-runtime.mjs.
//
// The algorithm, as the reference has it:
//   - one priority-ordered pass over every caption candidate of every class
//     (bodies, the Sun, the observer itself), fixed capacity; a candidate's
//     box is its anchor plus a width in cap heights of its text and a height
//     of 2.2 cap heights above a gap over the marker; a candidate is dropped
//     when its box comes within `spacingPixels` of a box already accepted by
//     a higher priority (overlaps are never drawn on top of one another);
//   - priority is brightness (the reference uses -magnitude) with the
//     focused object above everything (it is always admitted);
//   - sizing is cap-height relative: the label's capital letters land at
//     `capPixels`, and widths are measured per cap height, once, and cached;
//   - a fixed pool of slots shows the accepted captions; a slot keeps its
//     occupant while it stays accepted, and its alpha moves toward its target
//     by at most `maxAlphaStep` per publication, so text never jumps.
// Screen coordinates here are CSS pixels with +y DOWN (the projection's
// convention); the reference's y-up boxes are mirrored accordingly: a label
// sits ABOVE its anchor, so its box spans [anchorY - top, anchorY - bottom].

export const LABEL_OWNER_FOCUS = 0;
export const LABEL_OWNER_SUN = 1;
export const LABEL_OWNER_BODY = 2;

export const DEFAULT_LABEL_POLICY = Object.freeze({
  model: "priority-declutter-cap-height-captions",
  // Height of a capital letter on screen (the reference's labelCapPixels).
  capPixels: 12,
  // Gap between the marker's edge and the bottom of the caption.
  gapPixels: 7,
  // Clearance two captions must keep (the reference's LABEL_SPACING_PIXELS).
  spacingPixels: 4,
  // Box height in cap heights (ascenders and descenders included).
  boxHeightCaps: 2.2,
  // Retained slots; also the most captions ever visible at once.
  poolSize: 8,
  // Candidate capacity of the one pass.
  candidateCapacity: 64,
  // Alpha ceiling and the largest alpha change per publication.
  maxAlpha: 0.85,
  maxAlphaStep: 0.1,
  // Cap height of the shell's UI font stack as a share of the em: the
  // reference's own fallback for fonts without ink metrics (system-ui
  // faces measure 0.70-0.73); the acceptance test measures the painted
  // capitals against `capPixels` with that spread as its tolerance.
  capHeightEm: 0.72,
});

export function validateLabelPolicy(policy) {
  if (policy?.model !== DEFAULT_LABEL_POLICY.model ||
      !(policy.capPixels > 0) || !(policy.gapPixels >= 0) || !(policy.spacingPixels >= 0) ||
      !(policy.boxHeightCaps > 1) || !Number.isSafeInteger(policy.poolSize) || policy.poolSize < 1 ||
      !Number.isSafeInteger(policy.candidateCapacity) || policy.candidateCapacity < policy.poolSize ||
      !(policy.maxAlpha > 0) || policy.maxAlpha > 1 || !(policy.maxAlphaStep > 0) ||
      !(policy.capHeightEm > 0.5) || !(policy.capHeightEm < 1)) {
    throw new TypeError("Label policy is invalid.");
  }
  return policy;
}

// The one cross-class pass. Candidates are kept sorted by priority
// (descending) as they are added; `resolve` walks them in that order and
// accepts each whose box keeps the spacing from every box accepted before.
export function createLabelDeclutter({ capacity, spacingPixels }) {
  const candidates = [];
  return Object.freeze({
    reset() {
      candidates.length = 0;
    },
    // `anchor` is the marker's centre on screen; the box is centred on it
    // horizontally and spans `bottomOffset`..`topOffset` above it.
    add({ owner, id, priority, anchor, widthPx, bottomOffsetPx, topOffsetPx }) {
      if (candidates.length >= capacity) return false;
      const candidate = {
        owner, id, priority,
        left: anchor[0] - widthPx / 2, right: anchor[0] + widthPx / 2,
        // +y down: "bottom" (nearest the anchor) is the larger y.
        top: anchor[1] - topOffsetPx, bottom: anchor[1] - bottomOffsetPx,
        accepted: false,
      };
      let position = candidates.length;
      while (position > 0 && candidates[position - 1].priority < priority) position -= 1;
      candidates.splice(position, 0, candidate);
      return true;
    },
    resolve() {
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        let blocked = false;
        for (let placed = 0; placed < index; placed += 1) {
          const other = candidates[placed];
          if (!other.accepted) continue;
          const intersectionWidth = Math.min(candidate.right, other.right) - Math.max(candidate.left, other.left);
          const intersectionHeight = Math.min(candidate.bottom, other.bottom) - Math.max(candidate.top, other.top);
          if (Math.min(intersectionWidth, intersectionHeight) > -spacingPixels) {
            blocked = true;
            break;
          }
        }
        candidate.accepted = !blocked;
      }
      return candidates.filter((candidate) => candidate.accepted);
    },
    accepted(owner, id) {
      return candidates.some((candidate) => candidate.owner === owner && candidate.id === id && candidate.accepted);
    },
    get count() {
      return candidates.length;
    },
  });
}

// The retained slots. `assign(accepted)` keeps every slot whose occupant is
// still accepted, frees the others (their alpha ramps to zero before the
// slot is reused), and gives free slots to the highest-priority newcomers.
export function createLabelSlots({ poolSize, maxAlpha, maxAlphaStep }) {
  const slots = Array.from({ length: poolSize }, () => ({
    occupant: null, text: "", anchor: [0, 0], bottomOffsetPx: 0, alpha: 0, target: 0, changed: false,
  }));
  return Object.freeze({
    slots,
    assign(accepted, settled = true) {
      const byKey = new Map(accepted.map((entry) => [entry.key, entry]));
      const held = new Set();
      // Keep occupants that are still accepted; release the rest.
      for (const slot of slots) {
        slot.changed = false;
        if (slot.occupant !== null && byKey.has(slot.occupant)) {
          const entry = byKey.get(slot.occupant);
          slot.anchor = entry.anchor;
          slot.bottomOffsetPx = entry.bottomOffsetPx;
          slot.target = Math.min(maxAlpha, entry.alpha);
          held.add(slot.occupant);
        } else if (slot.occupant !== null) {
          slot.target = 0;
        }
      }
      // Alpha moves toward its target by at most one step per publication;
      // a slot whose occupant has faded out is freed.
      for (const slot of slots) {
        if (slot.occupant === null) continue;
        const delta = slot.target - slot.alpha;
        slot.alpha += settled ? Math.sign(delta) * Math.min(Math.abs(delta), maxAlphaStep) : delta;
        if (slot.alpha <= 0 && slot.target === 0) {
          slot.alpha = 0;
          slot.occupant = null;
          slot.text = "";
        }
      }
      // Newcomers, highest priority first, into the free slots; they start
      // from nothing and ramp in (or adopt their target on the first
      // publication, so nothing fades in from an empty stage).
      const newcomers = accepted.filter((entry) => !held.has(entry.key))
        .sort((a, b) => b.priority - a.priority);
      for (const entry of newcomers) {
        const slot = slots.find((candidate) => candidate.occupant === null);
        if (!slot) break;
        slot.occupant = entry.key;
        slot.text = entry.text;
        slot.anchor = entry.anchor;
        slot.bottomOffsetPx = entry.bottomOffsetPx;
        slot.target = Math.min(maxAlpha, entry.alpha);
        slot.alpha = settled ? Math.min(slot.target, maxAlphaStep) : slot.target;
        slot.changed = true;
      }
      return slots;
    },
  });
}

// Cap-height sizing: the font size that lands capitals at `capPixels`, and
// a caption's box width from its measured width per cap height.
export function labelFontPixels(policy) {
  return policy.capPixels / policy.capHeightEm;
}

export function labelBox(policy, { widthPerCapHeight, markerRadiusPx }) {
  const bottomOffsetPx = markerRadiusPx + policy.gapPixels;
  return Object.freeze({
    widthPx: widthPerCapHeight * policy.capPixels,
    bottomOffsetPx,
    topOffsetPx: bottomOffsetPx + policy.capPixels * policy.boxHeightCaps,
  });
}
