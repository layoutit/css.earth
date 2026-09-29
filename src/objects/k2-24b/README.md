# K2-24 b

## Sources

It is one of 2 planets known around K2-24. Its orbit and size follow Nascimbeni et al. 2024's fit, the archive's default. This account was drafted from Nascimbeni et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.50298954 Jupiter radii from Nascimbeni et al. 2024 (2024A&A...690A.349N), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A.349N/abstract): 35,959.7 km at 71,492 km per Jupiter radius. GM from the mass 0.06481485 Jupiter masses (Nascimbeni et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...690A.349N), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...690A.349N/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): P 20.88506 d Nascimbeni et al. 2024 (2024A&A...690A.349N), via the NASA Exoplanet Archive ps table (pl_refname NASCIMBENI_ET_AL_2024): a/R* 30.38; Nascimbeni et al. 2024 (2024A&A...690A.349N), via the NASA Exoplanet Archive ps table (pl_refname NASCIMBENI_ET_AL_2024): inclination 89.63 degrees Nascimbeni et al. 2024 (2024A&A...690A.349N), via the NASA Exoplanet Archive ps table (pl_refname NASCIMBENI_ET_AL_2024): e 0.0498 Nascimbeni et al. 2024 (2024A&A...690A.349N), via the NASA Exoplanet Archive ps table (pl_refname NASCIMBENI_ET_AL_2024): omega 351.8 degrees Kruse et al. 2019 (2019ApJS..244...11K), via the NASA Exoplanet Archive ps table (pl_refname KRUSE_ET_AL__2019): transit mid-time 2456905.79581 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 77 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-24's measured colour (#ffe7d6, the colour lens of k2-24 (src/objects/k2-24/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-24's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-24b.json).


## Known problems

- **Orbit convention.** omega 351.8 degrees is taken as Nascimbeni et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0498) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
