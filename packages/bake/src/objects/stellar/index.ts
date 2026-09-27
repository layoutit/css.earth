// `@cssearth/bake/objects/stellar` (Node only): a star's colour lens from its measured, Gaia XP or Planck spectrum and its
// limb darkening, starspots drawn from a published figure or occultation, and Roche-von Zeipel gravity darkening. A topic of
// its own, not part of `objects/layers/observation`, so code that reaches the observation layer does not reach the source
// manifests the colour records are read through.
export * from './gravity-darkening.ts';
export * from './stellar-photometric-color.ts';
export * from './stellar-spot-figure.ts';
export * from './stellar-spot-occultation.ts';
