# HIP 67522 b

## Sources

It is one of 2 planets known around HIP 67522. Its orbit and size follow Barber et al. 2024's fit, the archive's default. This account was drafted from Barber et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.891 Jupiter radii from Barber et al. 2024 (2024ApJ...973L..30B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L..30B/abstract): 63,699.4 km at 71,492 km per Jupiter radius. GM from the mass 0.225 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Barber et al. 2024 (2024ApJ...973L..30B), via the NASA Exoplanet Archive ps table (pl_refname BARBER_ET_AL__2024): P 6.9594731 d Barber et al. 2024 (2024ApJ...973L..30B), via the NASA Exoplanet Archive ps table (pl_refname BARBER_ET_AL__2024): a/R* 11.66; Barber et al. 2024 (2024ApJ...973L..30B), via the NASA Exoplanet Archive ps table (pl_refname BARBER_ET_AL__2024): inclination 89.88 degrees Barber et al. 2024 (2024ApJ...973L..30B), via the NASA Exoplanet Archive ps table (pl_refname BARBER_ET_AL__2024): e 0.064 Barber et al. 2024 (2024ApJ...973L..30B), via the NASA Exoplanet Archive ps table (pl_refname BARBER_ET_AL__2024): omega 195.3 degrees Barber et al. 2024 (2024ApJ...973L..30B), via the NASA Exoplanet Archive ps table (pl_refname BARBER_ET_AL__2024): transit mid-time 2458604.02376 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hip-67522's measured colour (#ffefe7, the colour lens of hip-67522 (src/objects/hip-67522/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HIP 67522's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (64, 101, 102), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hip-67522b.json).


## Known problems

- **Orbit convention.** omega 195.3 degrees is taken as Barber et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.064) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "HIP 67522 b" (revision 1375570410), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
