# TOI-421 c

## Sources

It is one of 2 planets known around TOI-421. Its orbit and size follow Krenn et al. 2024's fit, the archive's default. This account was drafted from Krenn et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.45410017 Jupiter radii from Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...686A.301K/abstract): 32,464.5 km at 71,492 km per Jupiter radius. GM from the mass 0.04436356 Jupiter masses (Krenn et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...686A.301K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...686A.301K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): P 16.067541 d Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): a/R* derived from its semi-major axis 0.117 au and stellar radius 0.866 solar radii; Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): inclination 88.353 degrees Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): e 0.19 Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): omega 102 degrees Krenn et al. 2024 (2024A&A...686A.301K), via the NASA Exoplanet Archive ps table (pl_refname KRENN_ET_AL__2024): transit mid-time 2459195.30741 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-421's measured colour (#ffeadd, the colour lens of toi-421 (src/objects/toi-421/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-421's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (6, 32, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-421c.json).


## Known problems

- **Orbit convention.** omega 102 degrees is taken as Krenn et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.19) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
