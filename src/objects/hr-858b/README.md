# HR 858 b

## Sources

It is one of 3 planets known around HR 858. Its orbit and size follow Bonfanti et al. 2025's fit, the archive's default. The introduction is generated from Bonfanti et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.17878521 Jupiter radii from Bonfanti et al. 2025 (2025A&A...693A..90B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...693A..90B/abstract): 12,781.7 km at 71,492 km per Jupiter radius. GM from the mass 0.01116955 Jupiter masses (Bonfanti et al. 2025 (2025A&A...693A..90B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...693A..90B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.58529 d Bonfanti et al. 2025 (2025A&A...693A..90B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2025): a/R* 8.37; Bonfanti et al. 2025 (2025A&A...693A..90B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2025): inclination 85.98 degrees Bonfanti et al. 2025 (2025A&A...693A..90B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2025): e 0 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459169.27128 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 8 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Charts.** The orbits of HR 858's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-24 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hr-858b.json).

## Known problems

- **Transit timing.** In TESS sectors 97, 105 and 106 (2025-2026) the transit comes 294, 390 and 412 min before the orbit's straight-line ephemeris, which is uncertain by only 8 min there; with HR 858 c and d masked the dip is 229-239 ppm at 19-29 sigma. Bonfanti et al. (2024, [arXiv:2411.14911](https://arxiv.org/abs/2411.14911)) report significant transit-timing variations of b and c, close to the 5:3 resonance, of up to 5 hours in their simulation. No archive product gives a TTV ephemeris, so the orbit stays the straight line and the Charts tab has no transit ([ledger](investigations.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
