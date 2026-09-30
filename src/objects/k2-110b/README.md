# K2-110 b

## Sources

It is the only planet known around K2-110. Its orbit and size follow Bonomo et al. 2023's fit, the archive's default. The introduction is generated from Bonomo et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.23124315 Jupiter radii from Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract): 16,532 km at 71,492 km per Jupiter radius. GM from the mass 0.05002699 Jupiter masses (Bonomo et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023A&A...677A..33B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): P 13.8636 d Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL_2023): a/R* derived from its semi-major axis 0.10207 au and stellar radius 0.713 solar radii; Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL_2023): inclination 89.35 degrees Osborn et al. 2017 (2017A&A...604A..19O), via the NASA Exoplanet Archive ps table (pl_refname OSBORN_ET_AL__2017): e 0.079 Osborn et al. 2017 (2017A&A...604A..19O), via the NASA Exoplanet Archive ps table (pl_refname OSBORN_ET_AL__2017): omega 90 degrees Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): transit mid-time 2457219.87496 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 72 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-110's measured colour (#ffddc6, the colour dataset of k2-110 (src/objects/k2-110/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-110's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-110b.json).

## Known problems

- **Orbit convention.** omega 90 degrees is taken as Osborn et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.079) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
