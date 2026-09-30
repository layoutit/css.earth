# TOI-132 b

## Sources

It is the only planet known around TOI-132. Its orbit and size follow Díaz et al. 2020's fit, the archive's default. The introduction is generated from Díaz et al. 2020's published values; the sections below are the data's own.

**Size and mass.** Radius 0.30511196 Jupiter radii from Díaz et al. 2020 (2020MNRAS.493..973D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020MNRAS.493..973D/abstract): 21,813.1 km at 71,492 km per Jupiter radius. GM from the mass 0.07047793 Jupiter masses (Díaz et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020MNRAS.493..973D), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020MNRAS.493..973D/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Patel & Espinoza 2022 (2022AJ....163..228P), via the NASA Exoplanet Archive ps table (pl_refname PATEL__AMP__ESPINOZA_2022): P 2.1096935 d Díaz et al. 2020 (2020MNRAS.493..973D), via the NASA Exoplanet Archive ps table (pl_refname D_IACUTE_AZ_ET_AL__2020): a/R* 6.362; Díaz et al. 2020 (2020MNRAS.493..973D), via the NASA Exoplanet Archive ps table (pl_refname D_IACUTE_AZ_ET_AL__2020): inclination 85.03 degrees Díaz et al. 2020 (2020MNRAS.493..973D), via the NASA Exoplanet Archive ps table (pl_refname D_IACUTE_AZ_ET_AL__2020): e 0.059 Díaz et al. 2020 (2020MNRAS.493..973D), via the NASA Exoplanet Archive ps table (pl_refname D_IACUTE_AZ_ET_AL__2020): omega 125.88 degrees Patel & Espinoza 2022 (2022AJ....163..228P), via the NASA Exoplanet Archive ps table (pl_refname PATEL__AMP__ESPINOZA_2022): transit mid-time 2459084.28228 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-132's measured colour (#ffe8d8, the colour dataset of toi-132 (src/objects/toi-132/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-132's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (95, 105, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-132b.json).

## Known problems

- **Orbit convention.** omega 125.88 degrees is taken as Díaz et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.059) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
