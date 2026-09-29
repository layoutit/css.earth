# TOI-7149 b

## Sources

It is the only planet known around TOI-7149. Its orbit and size follow Kanodia et al. 2025's fit, the archive's default. This account was drafted from Kanodia et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 1.18 Jupiter radii from Kanodia et al. 2025 (2025AJ....170..203K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025AJ....170..203K/abstract): 84,360.6 km at 71,492 km per Jupiter radius. GM from the mass 0.705 Jupiter masses (Kanodia et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025AJ....170..203K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025AJ....170..203K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kanodia et al. 2025 (2025AJ....170..203K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL_2025): P 2.65206166 d Kanodia et al. 2025 (2025AJ....170..203K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL_2025): a/R* 15.52; Kanodia et al. 2025 (2025AJ....170..203K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL_2025): inclination 89.25 degrees Kanodia et al. 2025 (2025AJ....170..203K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL_2025): e 0.078 Kanodia et al. 2025 (2025AJ....170..203K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL_2025): omega -16.4 degrees, stored as 343.6 Kanodia et al. 2025 (2025AJ....170..203K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL_2025): transit mid-time 2459703.59605 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-7149's measured colour (#ffc384, the colour lens of toi-7149 (src/objects/toi-7149/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-7149's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-7149b.json).


## Known problems

- **Orbit convention.** omega -16.4 degrees is taken as Kanodia et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.078) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
