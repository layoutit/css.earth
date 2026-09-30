# TOI-421 b

## Sources

It is one of 2 planets known around TOI-421. Its orbit and size follow Krenn et al. 2024's fit, the archive's default. This account was drafted from Krenn et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.23552543 Jupiter radii from Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...686A.301K/abstract): 16,838.2 km at 71,492 km per Jupiter radius. GM from the mass 0.02108056 Jupiter masses (Krenn et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...686A.301K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...686A.301K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): P 5.197576 d Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): a/R* derived from its semi-major axis 0.0554 au and stellar radius 0.866 solar radii; Carleo et al. 2020 (2020AJ....160..114C), via the NASA Exoplanet Archive ps table (pl_refname CARLEO_ET_AL__2020): inclination 85.68 degrees Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): e 0.13 Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): omega 140 degrees Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): transit mid-time 2459189.7341 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-421's measured colour (#ffeadd, the colour dataset of toi-421 (src/objects/toi-421/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-421's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (6, 32, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-421b.json).


## Known problems

- **Orbit convention.** omega 140 degrees is taken as Krenn et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.13) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
