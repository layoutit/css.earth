# TOI-1670 b

## Sources

It is one of 2 planets known around TOI-1670. Its orbit and size follow Tran et al. 2022's fit, the archive's default. The introduction is generated from Tran et al. 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 0.18378121 Jupiter radii from Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..225T/abstract): 13,138.9 km at 71,492 km per Jupiter radius. No mass is measured: Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..225T/abstract) gives only an upper limit of 0.13 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 10.9836724 d Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive ps table (pl_refname TRAN_ET_AL_2022): a/R* 16.88; Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive ps table (pl_refname TRAN_ET_AL_2022): inclination 86.87 degrees Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive ps table (pl_refname TRAN_ET_AL_2022): e 0.59 Tran et al. 2022 (2022AJ....163..225T), via the NASA Exoplanet Archive ps table (pl_refname TRAN_ET_AL_2022): omega 163.6 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460468.361028 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 6 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-1670's measured color (#f6f2ff, the color dataset of toi-1670 (src/objects/toi-1670/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1670's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (84, 85, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1670b.json).

## Known problems

- **Orbit convention.** omega 163.6 degrees is taken as Tran et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.59) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
