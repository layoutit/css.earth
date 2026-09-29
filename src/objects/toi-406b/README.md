# TOI-406 b

## Sources

It is one of 2 planets known around TOI-406. Its orbit and size follow Lacedelli et al. 2024's fit, the archive's default. This account was drafted from Lacedelli et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.18556549 Jupiter radii from Lacedelli et al. 2024 (2024A&A...692A.238L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...692A.238L/abstract): 13,266.4 km at 71,492 km per Jupiter radius. GM from the mass 0.02067153 Jupiter masses (Lacedelli et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...692A.238L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...692A.238L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Lacedelli et al. 2024 (2024A&A...692A.238L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2024): P 13.175682 d Lacedelli et al. 2024 (2024A&A...692A.238L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2024): a/R* 44.6; Lacedelli et al. 2024 (2024A&A...692A.238L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2024): inclination 89.4 degrees Lacedelli et al. 2024 (2024A&A...692A.238L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2024): e 0.056 Lacedelli et al. 2024 (2024A&A...692A.238L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2024): omega 169 degrees Lacedelli et al. 2024 (2024A&A...692A.238L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2024): transit mid-time 2458388.57 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-406's measured colour (#ffce8c, the colour lens of toi-406 (src/objects/toi-406/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-406's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (97, 105, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-406b.json).


## Known problems

- **Orbit convention.** omega 169 degrees is taken as Lacedelli et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.056) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
