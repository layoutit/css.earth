// The known perturbations of the catalogue sky layer, applied by the
// browser suite at mount (catalog-sky-browser.mjs, `--mutation <id>`) and
// driven by the gate (catalog-sky-mutation-gate.mjs), which requires each
// to turn the named checks red. Kept apart from the suite so importing the
// list does not run it.
export const CATALOG_SKY_MUTATIONS = Object.freeze({
  // Every prepared star mirrored about the view axis: placement fails.
  "mirror-placement": { trips: "star-placement-" },
  // The oracle itself rotated by 1.5 degrees: placement and the
  // photographic cross-check both fail, so the photo check is proven live.
  "oracle-rotated": { trips: "photo-registration-" },
  // The label pass accepting every candidate, with the ordinary budget
  // raised to the pool: captions overlap.
  "no-declutter": { trips: "captions-do-not-overlap-" },
  // No named star faint enough to be captioned: no caption anywhere.
  "no-captions": { trips: "caption-shown-" },
  // Every star at the pin radius: the size hierarchy is gone.
  "flat-sizes": { trips: "size-hierarchy-" },
  // The session knob hiding every band: the field is empty.
  "bands-hidden": { trips: "stars-cover-" },
});
