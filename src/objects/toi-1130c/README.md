# TOI-1130 c

## Sources

It is one of 2 planets known around TOI-1130. Its orbit and size follow Borsato et al. 2024's fit, the archive's default. This account was drafted from Borsato et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 1.15978431 Jupiter radii from Borsato et al. 2024 (2024A&A...689A..52B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...689A..52B/abstract): 82,915.3 km at 71,492 km per Jupiter radius. GM from the mass 1.05717423 Jupiter masses (Borsato et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...689A..52B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...689A..52B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 8.3498494 d Borsato et al. 2024 (2024A&A...689A..52B), via the NASA Exoplanet Archive ps table (pl_refname BORSATO_ET_AL_2024): a/R* derived from its semi-major axis 0.0731 au and stellar radius 0.697 solar radii; Borsato et al. 2024 (2024A&A...689A..52B), via the NASA Exoplanet Archive ps table (pl_refname BORSATO_ET_AL_2024): inclination 87.61 degrees Borsato et al. 2024 (2024A&A...689A..52B), via the NASA Exoplanet Archive ps table (pl_refname BORSATO_ET_AL_2024): e 0.0398 Borsato et al. 2024 (2024A&A...689A..52B), via the NASA Exoplanet Archive ps table (pl_refname BORSATO_ET_AL_2024): omega 182.5 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458841.6013 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1130's measured colour (#ffc49d, the colour lens of toi-1130 (src/objects/toi-1130/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1130's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1130c.json).


## Known problems

- **Orbit convention.** omega 182.5 degrees is taken as Borsato et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0398) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
