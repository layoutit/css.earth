# TOI-198 b

## Sources

It is the only planet known around TOI-198. Its orbit and size follow Zapatero Osorio et al. 2026's fit, the archive's default. The introduction is generated from Zapatero Osorio et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.12133128 Jupiter radii from Zapatero Osorio et al. 2026 (2026A&A...706A.166Z), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...706A.166Z/abstract): 8,674.2 km at 71,492 km per Jupiter radius. GM from the mass 0.00997394 Jupiter masses (Zapatero Osorio et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026A&A...706A.166Z), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026A&A...706A.166Z/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 10.21520251255 d Zapatero Osorio et al. 2026 (2026A&A...706A.166Z), via the NASA Exoplanet Archive ps table (pl_refname ZAPATERO_OSORIO_ET_AL_2026): a/R* 34.69; Zapatero Osorio et al. 2026 (2026A&A...706A.166Z), via the NASA Exoplanet Archive ps table (pl_refname ZAPATERO_OSORIO_ET_AL_2026): inclination 89.63 degrees Zapatero Osorio et al. 2026 (2026A&A...706A.166Z), via the NASA Exoplanet Archive ps table (pl_refname ZAPATERO_OSORIO_ET_AL_2026): e 0.15 Zapatero Osorio et al. 2026 (2026A&A...706A.166Z), via the NASA Exoplanet Archive ps table (pl_refname ZAPATERO_OSORIO_ET_AL_2026): omega 90 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458356.371864 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 9 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-198's measured colour (#ffcf9b, the colour dataset of toi-198 (src/objects/toi-198/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-198's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (29, 69, 96), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-198b.json).

## Known problems

- **Orbit convention.** omega 90 degrees is taken as Zapatero Osorio et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.15) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
