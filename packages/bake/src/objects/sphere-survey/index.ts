// `@cssearth/bake/objects/sphere-survey` (Node only): the VLT/SPHERE asteroid survey (Vernazza et al. 2021) as a source of
// photograph lenses: the LAM release's frame listings and downloads, the frames a lens casts grouped into apparitions and
// series, which apparitions a lens can join from the surface their frames share, and the survey figure's printed frame
// labels read by glyph. `packages/bake/cli/sphere-survey-apparitions.mts` audits the shipped survey lenses; the setup and
// install commands stay in `tools/objects/sphere-survey/`.
export * from './lam.ts';
export * from './frames.ts';
export * from './figure-labels.ts';
export * from './apparitions.ts';
