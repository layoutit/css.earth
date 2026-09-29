# TOI-2447 b

## Sources

It is the only planet known around TOI-2447. Its orbit and size follow Gill et al. 2024's fit, the archive's default. This account was drafted from Gill et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.857 Jupiter radii from Gill et al. 2024 (2024MNRAS.533..109G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.533..109G/abstract): 61,268.6 km at 71,492 km per Jupiter radius. GM from the mass 0.393 Jupiter masses (Gill et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024MNRAS.533..109G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024MNRAS.533..109G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Gill et al. 2024 (2024MNRAS.533..109G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL_2024): P 69.33684 d Gill et al. 2024 (2024MNRAS.533..109G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL_2024): a/R* 77.82101; Gill et al. 2024 (2024MNRAS.533..109G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL_2024): inclination derived from its impact parameter 0.277 with its a/R* 77.821 and the orbit's e 0.17, omega -105 degrees (Winn 2010, eq. 7) Gill et al. 2024 (2024MNRAS.533..109G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL_2024): e 0.17 Gill et al. 2024 (2024MNRAS.533..109G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL_2024): omega -105 degrees, stored as 255 Gill et al. 2024 (2024MNRAS.533..109G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL_2024): transit mid-time 2459168.98798 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2447's measured colour (#fff3f2, the colour lens of toi-2447 (src/objects/toi-2447/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2447's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (32, 98, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2447b.json).


## Known problems

- **Orbit convention.** omega -105 degrees is taken as Gill et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.17) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
