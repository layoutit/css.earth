// `@cssearth/bake/objects/sphere-survey` (Node only): the VLT/SPHERE asteroid survey (Vernazza et al. 2021) as a source of
// photograph lenses: the LAM release's frame listings and downloads, the frames a lens casts grouped into apparitions and
// series, which apparitions a lens can join from the surface their frames share, and the survey figure's printed frame
// labels read by glyph; the setup of a body's lens (`survey-setup.ts`, with the survey figure table
// `vernazza-2021-figures.json`), its install into the body's package (`survey-install.ts`) and the measurement of a lens against
// its paper's comparison figure (`published-comparison.ts`). Their commands are `packages/bake/cli/sphere-survey-{setup,install,
// apparitions}.mts` and `published-comparison.mts`; they work in the checkout they run in.
export * from './lam.ts';
export * from './frames.ts';
export * from './figure-labels.ts';
export * from './apparitions.ts';
export * from './published-comparison.ts';
export * from './survey-setup.ts';
export * from './survey-install.ts';
