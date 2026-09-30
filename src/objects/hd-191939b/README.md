# HD 191939 b

## Sources

It is one of 6 planets known around HD 191939. Its orbit and size follow Lubin et al. 2022's fit, the archive's default. The introduction is generated from Orell-Miquel et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.30422035 Jupiter radii from Orell-Miquel et al. 2023 (2023A&A...669A..40O), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...669A..40O/abstract): 21,749.3 km at 71,492 km per Jupiter radius. GM from the mass 0.03146352 Jupiter masses (Orell-Miquel et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023A&A...669A..40O), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023A&A...669A..40O/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 8.8803281 d Orell-Miquel et al. 2023 (2023A&A...669A..40O), via the NASA Exoplanet Archive ps table (pl_refname ORELL_MIQUEL_ET_AL_2023): a/R* 18.36; Orell-Miquel et al. 2023 (2023A&A...669A..40O), via the NASA Exoplanet Archive ps table (pl_refname ORELL_MIQUEL_ET_AL_2023): inclination 88.1 degrees Orell-Miquel et al. 2023 (2023A&A...669A..40O), via the NASA Exoplanet Archive ps table (pl_refname ORELL_MIQUEL_ET_AL_2023): e 0.031 Orell-Miquel et al. 2023 (2023A&A...669A..40O), via the NASA Exoplanet Archive ps table (pl_refname ORELL_MIQUEL_ET_AL_2023): omega 5 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460651.26694 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-191939's measured colour (#ffeee7, the colour dataset of hd-191939 (src/objects/hd-191939/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 191939's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (83, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-191939b.json).

## Known problems

- **Orbit convention.** omega 5 degrees is taken as Orell-Miquel et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.031) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
