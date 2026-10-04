# HAT-P-34 b

## Sources

It is the only planet known around Sansuna. Its orbit and size follow Bonomo et al. 2017's fit, the archive's default. The introduction is generated from Bonomo et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.197 Jupiter radii from Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract): 85,575.9 km at 71,492 km per Jupiter radius. GM from the mass 3.33 Jupiter masses (Bonomo et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017A&A...602A.107B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 5.45264682 d Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): a/R* derived from its semi-major axis 0.06774 au and stellar radius 1.53 solar radii; Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): inclination 87.1 degrees Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): e 0.432 Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): omega 21.9 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458708.63767 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hat-p-34's measured color (#f0eeff, the color dataset of hat-p-34 (src/objects/hat-p-34/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Sansuna's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (41, 54, 81), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-34b.json).


## Known problems

- **Orbit convention.** omega 21.9 degrees is taken as Bonomo et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.432) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
