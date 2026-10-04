# HD 17156 b

## Sources

It is the only planet known around Nushagak. Its orbit and size follow Kane et al. 2023's fit, the archive's default. The introduction is generated from Kane et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 1.094 Jupiter radii from Kane et al. 2023 (2023AJ....165..252K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..252K/abstract): 78,212.2 km at 71,492 km per Jupiter radius. GM from the mass 3.26 Jupiter masses (Kane et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....165..252K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....165..252K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 21.2164387 d Kane et al. 2023 (2023AJ....165..252K), via the NASA Exoplanet Archive ps table (pl_refname KANE_ET_AL__2023): a/R* 23.11; Kane et al. 2023 (2023AJ....165..252K), via the NASA Exoplanet Archive ps table (pl_refname KANE_ET_AL__2023): inclination 86.51 degrees Kane et al. 2023 (2023AJ....165..252K), via the NASA Exoplanet Archive ps table (pl_refname KANE_ET_AL__2023): e 0.6772 Kane et al. 2023 (2023AJ....165..252K), via the NASA Exoplanet Archive ps table (pl_refname KANE_ET_AL__2023): omega 122.06 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2455499.305815 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by hd-17156's measured color (#fff7fd, the color dataset of hd-17156 (src/objects/hd-17156/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Nushagak's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (73, 79, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-17156b.json).


## Known problems

- **Orbit convention.** omega 122.06 degrees is taken as Kane et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.6772) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 17156 b" (revision 1374387189) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
