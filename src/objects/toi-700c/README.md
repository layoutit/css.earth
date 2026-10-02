# TOI-700 c

## Sources

It is one of 4 planets known around TOI-700. Its orbit and size follow Pass et al. 2026's fit, the archive's default. The introduction is generated from Pass et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.22615794 Jupiter radii from Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026AJ....172..175P/abstract): 16,168.5 km at 71,492 km per Jupiter radius. GM from the mass 0.0219 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL_2026): P 16.0511039 d Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL_2026): a/R* derived from its semi-major axis 0.0931 au and stellar radius 0.4104 solar radii; Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL_2026): inclination 88.942 degrees Gilbert et al. 2023 (2023ApJ...944L..35G), via the NASA Exoplanet Archive ps table (pl_refname GILBERT_ET_AL_2023): e 0.068 Gilbert et al. 2023 (2023ApJ...944L..35G), via the NASA Exoplanet Archive ps table (pl_refname GILBERT_ET_AL_2023): omega 30 degrees Pass et al. 2026 (2026AJ....172..175P), via the NASA Exoplanet Archive ps table (pl_refname PASS_ET_AL_2026): transit mid-time 2458821.6219 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-700's measured color (#ffc789, the color dataset of toi-700 (src/objects/toi-700/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-700's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (95, 96, 97), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-700c.json).

## Known problems

- **Orbit convention.** omega 30 degrees is taken as Gilbert et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.068) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
