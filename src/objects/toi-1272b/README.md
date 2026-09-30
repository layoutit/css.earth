# TOI-1272 b

## Sources

It is the only planet known around TOI-1272. Its orbit and size follow Mancini et al. 2026's fit, the archive's default. The introduction is generated from Mancini et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.3800524 Jupiter radii from Mancini et al. 2026 (2026A&A...712A.147M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026A&A...712A.147M/abstract): 27,170.7 km at 71,492 km per Jupiter radius. GM from the mass 0.07582708 Jupiter masses (Mancini et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026A&A...712A.147M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026A&A...712A.147M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Mancini et al. 2026 (2026A&A...712A.147M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL_2026): P 3.3159765 d Mancini et al. 2026 (2026A&A...712A.147M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL_2026): a/R* 11.03; Mancini et al. 2026 (2026A&A...712A.147M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL_2026): inclination 86 degrees Mancini et al. 2026 (2026A&A...712A.147M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL_2026): e 0.345 Mancini et al. 2026 (2026A&A...712A.147M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL_2026): omega 122 degrees Mancini et al. 2026 (2026A&A...712A.147M), via the NASA Exoplanet Archive ps table (pl_refname MANCINI_ET_AL_2026): transit mid-time 2458713.03098 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1272's measured colour (#ffe0ca, the colour dataset of toi-1272 (src/objects/toi-1272/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1272's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (22, 49, 76), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1272b.json).

## Known problems

- **Orbit convention.** omega 122 degrees is taken as Mancini et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.345) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
