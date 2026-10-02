# GJ 3470 b

## Sources

It is the only planet known around GJ 3470. Its orbit and size follow Awiphan et al. 2016's fit, the archive's default. The introduction is generated from Awiphan et al. 2016's published values; the sections below are the data's own.

**Size and mass.** Radius 0.40770809 Jupiter radii from Awiphan et al. 2016 (2016MNRAS.463.2574A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016MNRAS.463.2574A/abstract): 29,147.9 km at 71,492 km per Jupiter radius. GM from the mass 0.04373407 Jupiter masses (Awiphan et al. 2016, the mass the NASA Exoplanet Archive's composite table adopts (2016MNRAS.463.2574A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2016MNRAS.463.2574A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 3.3366524 d Awiphan et al. 2016 (2016MNRAS.463.2574A), via the NASA Exoplanet Archive ps table (pl_refname AWIPHAN_ET_AL__2016): a/R* 13.98; Awiphan et al. 2016 (2016MNRAS.463.2574A), via the NASA Exoplanet Archive ps table (pl_refname AWIPHAN_ET_AL__2016): inclination 89.13 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.017 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 1.7 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2456974.68988 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by gj-3470's measured color (#ffc68b, the color dataset of gj-3470 (src/objects/gj-3470/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of GJ 3470's planets from above, from their hosted-orbit records, and its transmission spectrum, 28 bins from Benneke et al. 2019 in the archive's transitspec table; its transit in 3 TESS sectors (46, 71, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-3470b.json).

## Known problems

- **Orbit convention.** omega 1.7 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.017) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "GJ 3470 b" (revision 1374245683) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
