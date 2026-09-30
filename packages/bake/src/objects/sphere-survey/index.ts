// `@cssearth/bake/objects/sphere-survey` (Node only): the VLT/SPHERE asteroid survey (Vernazza et al. 2021) as a source of
// photograph datasets: the LAM release's frame listings and downloads, the frames a dataset casts grouped into apparitions and
// series, which apparitions a dataset can join from the surface their frames share, and the survey figure's printed frame
// labels read by glyph; the setup of a body's dataset (`survey-setup.ts`, with the survey figure table
// `vernazza-2021-figures.json`), its install into the body's package (`survey-install.ts`) and the measurement of a dataset against
// its paper's comparison figure (`published-comparison.ts`). Their commands are `packages/bake/cli/sphere-survey-{setup,install,
// apparitions}.mts` and `published-comparison.mts`, which pass in the checkout they belong to.
export * from './lam.ts';
export * from './frames.ts';
export * from './figure-labels.ts';
export * from './apparitions.ts';
export * from './published-comparison.ts';
export * from './survey-setup.ts';
export * from './survey-install.ts';
