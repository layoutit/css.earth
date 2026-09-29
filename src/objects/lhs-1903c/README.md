# LHS 1903 c

## Sources

It is one of 4 planets known around LHS 1903. Its orbit and size follow Wilson et al. 2026's fit, the archive's default. This account was drafted from Wilson et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.18253221 Jupiter radii from Wilson et al. 2026 (2026Sci...392l2348W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026Sci...392l2348W/abstract): 13,049.6 km at 71,492 km per Jupiter radius. GM from the mass 0.0143159 Jupiter masses (Wilson et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026Sci...392l2348W), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026Sci...392l2348W/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 6.2262315 d Wilson et al. 2026 (2026Sci...392l2348W), via the NASA Exoplanet Archive ps table (pl_refname WILSON_ET_AL_2026): a/R* 21.48; Wilson et al. 2026 (2026Sci...392l2348W), via the NASA Exoplanet Archive ps table (pl_refname WILSON_ET_AL_2026): inclination derived from its impact parameter 0.513 with its a/R* 21.48 and the orbit's e 0.089, omega 288 degrees (Winn 2010, eq. 7) Wilson et al. 2026 (2026Sci...392l2348W), via the NASA Exoplanet Archive ps table (pl_refname WILSON_ET_AL_2026): e 0.089 Wilson et al. 2026 (2026Sci...392l2348W), via the NASA Exoplanet Archive ps table (pl_refname WILSON_ET_AL_2026): omega 288 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459952.635271 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 8 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by lhs-1903's measured colour (#ffcb94, the colour lens of lhs-1903 (src/objects/lhs-1903/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of LHS 1903's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (20, 47, 60), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/lhs-1903c.json).


## Known problems

- **Orbit convention.** omega 288 degrees is taken as Wilson et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.089) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
