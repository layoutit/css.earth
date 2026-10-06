// `@cssearth/bake/objects/stellar` (Node only): a star's color dataset from its measured, Gaia XP or Planck spectrum and its
// limb darkening, starspots drawn from a published figure or occultation, Roche-von Zeipel gravity darkening, and a corona
// density derived from a surface magnetic map (corona/). A topic of
// its own, not part of `objects/layers/observation`, so code that reaches the observation layer does not reach the source
// manifests the color records are read through.
export * from './gravity-darkening.ts';
export * from './limb-laws.ts';
export * from './nsx-atmosphere.ts';
export * from './stellar-photometric-color.ts';
export * from './stellar-spot-figure.ts';
export * from './stellar-spot-occultation.ts';
export * from './corona/display.ts';
export * from './corona/models.ts';
export * from './corona/potential-field.ts';
export * from './corona/sheet.ts';
