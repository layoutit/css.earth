# TOI-4010 b

## Sources

It is one of 4 planets known around TOI-4010. Its orbit and size follow Kunimoto et al. 2023's fit, the archive's default. This account was drafted from Kunimoto et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.26942682 Jupiter radii from Kunimoto et al. 2023 (2023AJ....166....7K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166....7K/abstract): 19,261.9 km at 71,492 km per Jupiter radius. GM from the mass 0.03460987 Jupiter masses (Kunimoto et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166....7K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166....7K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kunimoto et al. 2023 (2023AJ....166....7K), via the NASA Exoplanet Archive ps table (pl_refname KUNIMOTO_ET_AL__2023): P 1.348335 d Kunimoto et al. 2023 (2023AJ....166....7K), via the NASA Exoplanet Archive ps table (pl_refname KUNIMOTO_ET_AL__2023): a/R* derived from its semi-major axis 0.0229 au and stellar radius 0.83 solar radii; Kunimoto et al. 2023 (2023AJ....166....7K), via the NASA Exoplanet Archive ps table (pl_refname KUNIMOTO_ET_AL__2023): inclination 88.1 degrees Kunimoto et al. 2023 (2023AJ....166....7K), via the NASA Exoplanet Archive ps table (pl_refname KUNIMOTO_ET_AL__2023): e 0.03 Kunimoto et al. 2023 (2023AJ....166....7K), via the NASA Exoplanet Archive ps table (pl_refname KUNIMOTO_ET_AL__2023): omega 0 degrees Kunimoto et al. 2023 (2023AJ....166....7K), via the NASA Exoplanet Archive ps table (pl_refname KUNIMOTO_ET_AL__2023): transit mid-time 2459007.549 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 7 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-4010's measured colour (#ffdbc1, the colour lens of toi-4010 (src/objects/toi-4010/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4010's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (58, 78, 85), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4010b.json).


## Known problems

- **Orbit convention.** omega 0 degrees is taken as Kunimoto et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.03) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
