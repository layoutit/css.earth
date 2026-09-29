# TOI-1408 c

## Sources

It is one of 2 planets known around TOI-1408. Its orbit and size follow Korth et al. 2024's fit, the archive's default. This account was drafted from Korth et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.19805548 Jupiter radii from Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...971L..28K/abstract): 14,159.4 km at 71,492 km per Jupiter radius. GM from the mass 0.02391227 Jupiter masses (Korth et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJ...971L..28K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJ...971L..28K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 2.2222094 d Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive ps table (pl_refname KORTH_ET_AL_2024): a/R* 5.04; Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive ps table (pl_refname KORTH_ET_AL_2024): inclination 82.6 degrees Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive ps table (pl_refname KORTH_ET_AL_2024): e 0.1353 Korth et al. 2024 (2024ApJ...971L..28K), via the NASA Exoplanet Archive ps table (pl_refname KORTH_ET_AL_2024): omega 286.3 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460479.047419 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 9 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1408's measured colour (#faf5ff, the colour lens of toi-1408 (src/objects/toi-1408/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1408's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1408c.json).


## Known problems

- **Orbit convention.** omega 286.3 degrees is taken as Korth et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.1353) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
