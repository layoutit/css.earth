# TOI-771 b

## Sources

It is one of 2 planets known around TOI-771. Its orbit and size follow Lacedelli et al. 2025's fit, the archive's default. This account was drafted from Lacedelli et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.12133128 Jupiter radii from Lacedelli et al. 2025 (2025A&A...698A.223L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...698A.223L/abstract): 8,674.2 km at 71,492 km per Jupiter radius. GM from the mass 0.00777149 Jupiter masses (Lacedelli et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...698A.223L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...698A.223L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Lacedelli et al. 2025 (2025A&A...698A.223L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2025): P 2.3260155 d Lacedelli et al. 2025 (2025A&A...698A.223L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2025): a/R* 18.9; Lacedelli et al. 2025 (2025A&A...698A.223L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2025): inclination 89.3 degrees Lacedelli et al. 2025 (2025A&A...698A.223L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2025): e 0.055 Lacedelli et al. 2025 (2025A&A...698A.223L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2025): omega -130 degrees, stored as 230 Lacedelli et al. 2025 (2025A&A...698A.223L), via the NASA Exoplanet Archive ps table (pl_refname LACEDELLI_ET_AL_2025): transit mid-time 2458572.4191 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-771's measured colour (#ffc77b, the colour dataset of toi-771 (src/objects/toi-771/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-771's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (38, 64, 65), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-771b.json).


## Known problems

- **Orbit convention.** omega -130 degrees is taken as Lacedelli et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.055) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
