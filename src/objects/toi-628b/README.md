# TOI-628 b

## Sources

It is the only planet known around TOI-628. Its orbit and size follow Rodriguez et al. 2021's fit, the archive's default. The introduction is generated from Rodriguez et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 1.06 Jupiter radii from Rodriguez et al. 2021 (2021AJ....161..194R), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161..194R/abstract): 75,781.5 km at 71,492 km per Jupiter radius. GM from the mass 6.33 Jupiter masses (Rodriguez et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021AJ....161..194R), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....161..194R/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Rodriguez et al. 2021 (2021AJ....161..194R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2021): P 3.4095675 d Rodriguez et al. 2021 (2021AJ....161..194R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2021): a/R* 7.78; Rodriguez et al. 2021 (2021AJ....161..194R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2021): inclination 88.41 degrees Rodriguez et al. 2021 (2021AJ....161..194R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2021): e 0.072 Rodriguez et al. 2021 (2021AJ....161..194R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2021): omega -74 degrees, stored as 286 Rodriguez et al. 2021 (2021AJ....161..194R), via the NASA Exoplanet Archive ps table (pl_refname RODRIGUEZ_ET_AL__2021): transit mid-time 2458629.47972 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 7 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-628's measured color (#fff6f7, the color dataset of toi-628 (src/objects/toi-628/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-628's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (87), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-628b.json).

## Known problems

- **Orbit convention.** omega -74 degrees is taken as Rodriguez et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.072) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-628 b" (revision 1374392647) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
