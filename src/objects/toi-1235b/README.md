# TOI-1235 b

## Sources

It is the only planet known around TOI-1235. Its orbit and size follow Bluhm et al. 2020's fit, the archive's default. This account was drafted from Luque & Pallé 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.15077196 Jupiter radii from Luque & Pallé 2022 (2022Sci...377.1211L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022Sci...377.1211L/abstract): 10,779 km at 71,492 km per Jupiter radius. GM from the mass 0.02104909 Jupiter masses (Luque & Pallé 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022Sci...377.1211L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022Sci...377.1211L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.4447015 d Luque & Pallé 2022 (2022Sci...377.1211L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE__AMP__PALL_EACUTE__2022): a/R* derived by Kepler's third law from its period 3.4447015 d, stellar mass 0.63 and radius 0.619 solar units; Bluhm et al. 2020 (2020A&A...639A.132B), via the NASA Exoplanet Archive ps table (pl_refname BLUHM_ET_AL__2020): inclination 88.9 degrees Luque & Pallé 2022 (2022Sci...377.1211L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE__AMP__PALL_EACUTE__2022): e 0.049 Luque & Pallé 2022 (2022Sci...377.1211L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE__AMP__PALL_EACUTE__2022): omega 78 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460333.631473 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1235's measured colour (#ffc091, the colour lens of toi-1235 (src/objects/toi-1235/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1235's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (47, 60, 74), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1235b.json).


## Known problems

- **Orbit convention.** omega 78 degrees is taken as Luque & Pallé 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.049) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
