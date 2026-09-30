# WASP-132 b

## Sources

It is one of 3 planets known around WASP-132. Its orbit and size follow Grieves et al. 2025's fit, the archive's default. This account was drafted from Grieves et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.901 Jupiter radii from Grieves et al. 2025 (2025A&A...693A.144G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...693A.144G/abstract): 64,414.3 km at 71,492 km per Jupiter radius. GM from the mass 0.428 Jupiter masses (Grieves et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...693A.144G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...693A.144G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): P 7.1335125 d Grieves et al. 2025 (2025A&A...693A.144G), via the NASA Exoplanet Archive ps table (pl_refname GRIEVES_ET_AL__2025): a/R* derived from its semi-major axis 0.0674 au and stellar radius 0.758 solar radii; Grieves et al. 2025 (2025A&A...693A.144G), via the NASA Exoplanet Archive ps table (pl_refname GRIEVES_ET_AL__2025): inclination 89.46 degrees Grieves et al. 2025 (2025A&A...693A.144G), via the NASA Exoplanet Archive ps table (pl_refname GRIEVES_ET_AL__2025): e 0.0163 Grieves et al. 2025 (2025A&A...693A.144G), via the NASA Exoplanet Archive ps table (pl_refname GRIEVES_ET_AL__2025): omega 318 degrees Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): transit mid-time 2458602.85618 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by wasp-132's measured colour (#ffd4b8, the colour dataset of wasp-132 (src/objects/wasp-132/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-132's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (38, 65, 102), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-132b.json).


## Known problems

- **Orbit convention.** omega 318 degrees is taken as Grieves et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0163) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
