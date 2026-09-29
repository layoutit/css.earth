# TOI-201 b

## Sources

It is one of 3 planets known around TOI-201. Its orbit and size follow Mireles et al. 2026's fit, the archive's default. This account was drafted from Mireles et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 1.01704163 Jupiter radii from Mireles et al. 2026 (2026SciA...12f2618M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026SciA...12f2618M/abstract): 72,710.3 km at 71,492 km per Jupiter radius. GM from the mass 0.51600171 Jupiter masses (Mireles et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026SciA...12f2618M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026SciA...12f2618M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 52.978197 d Mireles et al. 2026 (2026SciA...12f2618M), via the NASA Exoplanet Archive ps table (pl_refname MIRELES_ET_AL_2026): a/R* derived from its semi-major axis 0.303 au and stellar radius 1.31 solar radii; Mireles et al. 2026 (2026SciA...12f2618M), via the NASA Exoplanet Archive ps table (pl_refname MIRELES_ET_AL_2026): inclination 91.18 degrees Mireles et al. 2026 (2026SciA...12f2618M), via the NASA Exoplanet Archive ps table (pl_refname MIRELES_ET_AL_2026): e 0.275 Mireles et al. 2026 (2026SciA...12f2618M), via the NASA Exoplanet Archive ps table (pl_refname MIRELES_ET_AL_2026): omega 83 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2459011.79063 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-201's measured colour (#f8f4ff, the colour lens of toi-201 (src/objects/toi-201/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-201's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (96, 97, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-201b.json).


## Known problems

- **Orbit convention.** omega 83 degrees is taken as Mireles et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.275) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
