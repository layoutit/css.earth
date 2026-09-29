# HD 97658 b

## Sources

It is the only planet known around HD 97658. Its orbit and size follow Ellis et al. 2021's fit, the archive's default. This account was drafted from Ellis et al. 2021's values; the sections below are the data's own.

**Size and mass.** Radius 0.18913406 Jupiter radii from Ellis et al. 2021 (2021AJ....162..118E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..118E/abstract): 13,521.6 km at 71,492 km per Jupiter radius. GM from the mass 0.02611472 Jupiter masses (Ellis et al. 2021 (2021AJ....162..118E), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....162..118E/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 9.4893037 d Ellis et al. 2021 (2021AJ....162..118E), via the NASA Exoplanet Archive ps table (pl_refname ELLIS_ET_AL__2021): a/R* 24.2; Ellis et al. 2021 (2021AJ....162..118E), via the NASA Exoplanet Archive ps table (pl_refname ELLIS_ET_AL__2021): inclination 89.05 degrees Rosenthal et al. 2021 (2021ApJS..255....8R), via the NASA Exoplanet Archive ps table (pl_refname ROSENTHAL_ET_AL__2021): e 0.063 Rosenthal et al. 2021 (2021ApJS..255....8R), via the NASA Exoplanet Archive ps table (pl_refname ROSENTHAL_ET_AL__2021): omega -10 degrees, stored as 350 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2457339.205224 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Charts.** The orbits of HD 97658's planets from above, from their hosted-orbit records, and its transmission spectrum, 28 bins from Knutson et al. 2014 in the archive's transitspec table; its transit in 2 TESS sectors (22, 49), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-24 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-97658b.json).


## Known problems

- **Orbit convention.** omega -10 degrees is taken as Rosenthal et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
