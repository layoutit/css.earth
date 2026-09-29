# TOI-1728 b

## Sources

It is the only planet known around TOI-1728. Its orbit and size follow Kanodia et al. 2020's fit, the archive's default. This account was drafted from Kanodia et al. 2020's values; the sections below are the data's own.

**Size and mass.** Radius 0.45053082 Jupiter radii from Kanodia et al. 2020 (2020ApJ...899...29K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020ApJ...899...29K/abstract): 32,209.3 km at 71,492 km per Jupiter radius. GM from the mass 0.08425888 Jupiter masses (Kanodia et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020ApJ...899...29K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020ApJ...899...29K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Antonov et. al 2026, via the NASA Exoplanet Archive ps table (pl_refname ANTONOV_ET_AL_2026): P 3.491402 d Kanodia et al. 2020 (2020ApJ...899...29K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2020): a/R* 13.48; Kanodia et al. 2020 (2020ApJ...899...29K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2020): inclination 88.31 degrees Kanodia et al. 2020 (2020ApJ...899...29K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2020): e 0.057 Kanodia et al. 2020 (2020ApJ...899...29K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2020): omega 45 degrees Antonov et. al 2026, via the NASA Exoplanet Archive ps table (pl_refname ANTONOV_ET_AL_2026): transit mid-time 2458839.7833 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1728's measured colour (#ffbf8e, the colour lens of toi-1728 (src/objects/toi-1728/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1728's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (20, 47, 74), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1728b.json).


## Known problems

- **Orbit convention.** omega 45 degrees is taken as Kanodia et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.057) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
