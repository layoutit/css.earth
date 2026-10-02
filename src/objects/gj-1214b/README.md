# GJ 1214 b

## Sources

It is the only planet known around GJ 1214. Its orbit and size follow Mahajan et al. 2024's fit, the archive's default. The introduction is generated from Mahajan et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.24382235 Jupiter radii from Mahajan et al. 2024 (2024ApJ...963L..37M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...963L..37M/abstract): 17,431.3 km at 71,492 km per Jupiter radius. GM from the mass 0.02646082 Jupiter masses (Mahajan et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJ...963L..37M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJ...963L..37M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Mahajan et al. 2024 (2024ApJ...963L..37M), via the NASA Exoplanet Archive ps table (pl_refname MAHAJAN_ET_AL__2024): P 1.580404531 d Mahajan et al. 2024 (2024ApJ...963L..37M), via the NASA Exoplanet Archive ps table (pl_refname MAHAJAN_ET_AL__2024): a/R* 14.97; Mahajan et al. 2024 (2024ApJ...963L..37M), via the NASA Exoplanet Archive ps table (pl_refname MAHAJAN_ET_AL__2024): inclination 88.98 degrees Mahajan et al. 2024 (2024ApJ...963L..37M), via the NASA Exoplanet Archive ps table (pl_refname MAHAJAN_ET_AL__2024): e 0.0062 Mahajan et al. 2024 (2024ApJ...963L..37M), via the NASA Exoplanet Archive ps table (pl_refname MAHAJAN_ET_AL__2024): omega 77 degrees Mahajan et al. 2024 (2024ApJ...963L..37M), via the NASA Exoplanet Archive ps table (pl_refname MAHAJAN_ET_AL__2024): transit mid-time 2459639.7812619 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by gj-1214's measured color (#ffca76, the color dataset of gj-1214 (src/objects/gj-1214/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of GJ 1214's planets from above, from their hosted-orbit records, and its transmission spectrum, 22 bins from Kreidberg et al. 2014 in the archive's transitspec table; its dayside emission, 14 bins from Kempton et al. 2023 in the archive's emissionspec table. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-1214b.json).

## Known problems

- **Orbit convention.** omega 77 degrees is taken as Mahajan et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0062) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "GJ 1214 b" (revision 1374248506) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
