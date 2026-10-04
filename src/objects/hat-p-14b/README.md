# HAT-P-14 b

## Sources

It is the only planet known around Franz. Its orbit and size follow Stassun et al. 2017's fit, the archive's default. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.42 Jupiter radii from Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract): 101,518.6 km at 71,492 km per Jupiter radius. GM from the mass 3.44 Jupiter masses (Stassun et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153..136S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 4.62766098 d Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): a/R* 8.9; Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): inclination 83.5 degrees Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): e 0.1074 Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): omega 106.1 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2457304.81275 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hat-p-14's measured color (#efedff, the color dataset of hat-p-14 (src/objects/hat-p-14/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Franz's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (52, 53, 80), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-14b.json).


## Known problems

- **Orbit convention.** omega 106.1 degrees is taken as Bonomo et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.1074) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-14b" (revision 1374169060) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
