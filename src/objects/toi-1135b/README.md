# TOI-1135 b

## Sources

It is the only planet known around TOI-1135. Its orbit and size follow Dugan et al. 2025's fit, the archive's default. The introduction is generated from Dugan et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.885 Jupiter radii from Dugan et al. 2025 (2025ApJ...994L..23D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...994L..23D/abstract): 63,270.4 km at 71,492 km per Jupiter radius. No mass is measured: Dugan et al. 2025 (2025ApJ...994L..23D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJ...994L..23D/abstract) gives only an upper limit of 0.185 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 8.0277326 d Dugan et al. 2025 (2025ApJ...994L..23D), via the NASA Exoplanet Archive ps table (pl_refname DUGAN_ET_AL_2025): a/R* 14.57; Dugan et al. 2025 (2025ApJ...994L..23D), via the NASA Exoplanet Archive ps table (pl_refname DUGAN_ET_AL_2025): inclination 89.3 degrees Dugan et al. 2025 (2025ApJ...994L..23D), via the NASA Exoplanet Archive ps table (pl_refname DUGAN_ET_AL_2025): e 0.062 Dugan et al. 2025 (2025ApJ...994L..23D), via the NASA Exoplanet Archive ps table (pl_refname DUGAN_ET_AL_2025): omega -10 degrees, stored as 350 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460658.97426 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at the 1,171 K equilibrium temperature of Dugan et al. 2025, equilibrium temperature (NASA Exoplanet Archive planetary systems table): #ff4b00. Chosen by rule: 3 papers in the archive print one; the archive's default parameter set. On 120 hot Jupiters whose day side Spitzer measured, the measured temperature is within 20% of this kind of estimate for 83% (Deming et al. 2023); see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Charts.** The orbits of TOI-1135's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (74, 79, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1135b.json).

## Known problems

- **Orbit convention.** omega -10 degrees is taken as Dugan et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.062) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
