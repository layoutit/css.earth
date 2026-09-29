# TOI-4465 b

## Sources

It is the only planet known around TOI-4465. Its orbit and size follow Essack et al. 2025's fit, the archive's default. This account was drafted from Essack et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 1.25 Jupiter radii from Essack et al. 2025 (2025AJ....170...41E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170...41E/abstract): 89,365 km at 71,492 km per Jupiter radius. GM from the mass 5.89 Jupiter masses (Essack et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025AJ....170...41E), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025AJ....170...41E/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Essack et al. 2025 (2025AJ....170...41E), via the NASA Exoplanet Archive ps table (pl_refname ESSACK_ET_AL__2025): P 101.94054 d Essack et al. 2025 (2025AJ....170...41E), via the NASA Exoplanet Archive ps table (pl_refname ESSACK_ET_AL__2025): a/R* 88.4; Essack et al. 2025 (2025AJ....170...41E), via the NASA Exoplanet Archive ps table (pl_refname ESSACK_ET_AL__2025): inclination 89.95 degrees Essack et al. 2025 (2025AJ....170...41E), via the NASA Exoplanet Archive ps table (pl_refname ESSACK_ET_AL__2025): e 0.24 Essack et al. 2025 (2025AJ....170...41E), via the NASA Exoplanet Archive ps table (pl_refname ESSACK_ET_AL__2025): omega 279.74 degrees Essack et al. 2025 (2025AJ....170...41E), via the NASA Exoplanet Archive ps table (pl_refname ESSACK_ET_AL__2025): transit mid-time 2459395.1256 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 9 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-4465's measured colour (#ffefe6, the colour lens of toi-4465 (src/objects/toi-4465/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4465's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4465b.json).


## Known problems

- **Orbit convention.** omega 279.74 degrees is taken as Essack et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.24) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
