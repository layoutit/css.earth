# K2-85 b

## Sources

It is the only planet known around K2-85. Its orbit and size follow Howard et al. 2025's fit, the archive's default. This account was drafted from Howard et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.12489985 Jupiter radii from Howard et al. 2025 (2025ApJS..278...52H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract): 8,929.3 km at 71,492 km per Jupiter radius. GM from the mass 0.01006833 Jupiter masses (Howard et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025ApJS..278...52H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): P 0.684541 d Howard et al. 2025 (2025ApJS..278...52H), via the NASA Exoplanet Archive ps table (pl_refname HOWARD_ET_AL__2025): a/R* derived by Kepler's third law from its period 0.684541 d, stellar mass 0.7 and radius 0.71 solar units; Adams et al. 2021 (2021PSJ.....2..152A), via the NASA Exoplanet Archive ps table (pl_refname ADAMS_ET_AL__2021): inclination 89.4 degrees Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): e 0.24 Dressing et al. 2017 (2017AJ....154..207D), via the NASA Exoplanet Archive ps table (pl_refname DRESSING_ET_AL__2017): omega 67.59 degrees Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): transit mid-time 2457061.94482 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 70 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-85's measured colour (#ffc49b, the colour dataset of k2-85 (src/objects/k2-85/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-85's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (44, 70, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-85b.json).


## Known problems

- **Orbit convention.** omega 67.59 degrees is taken as Dressing et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.24) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
