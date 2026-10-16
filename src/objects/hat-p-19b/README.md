# HAT-P-19 b

## Sources

It is the only planet known around HAT-P-19. Its orbit and size follow Kang et al. 2024's fit, the archive's default. The introduction is generated from Kang et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 1.008 Jupiter radii from Kang et al. 2024 (2024MNRAS.528.1930K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.528.1930K/abstract): 72,063.9 km at 71,492 km per Jupiter radius. GM from the mass 0.277 Jupiter masses (Kang et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024MNRAS.528.1930K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024MNRAS.528.1930K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kang et al. 2024 (2024MNRAS.528.1930K), via the NASA Exoplanet Archive ps table (pl_refname KANG_ET_AL_2024): P 4.00878322 d Kang et al. 2024 (2024MNRAS.528.1930K), via the NASA Exoplanet Archive ps table (pl_refname KANG_ET_AL_2024): a/R* 12.84; Kang et al. 2024 (2024MNRAS.528.1930K), via the NASA Exoplanet Archive ps table (pl_refname KANG_ET_AL_2024): inclination 89.52 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.07 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 256 degrees Kang et al. 2024 (2024MNRAS.528.1930K), via the NASA Exoplanet Archive ps table (pl_refname KANG_ET_AL_2024): transit mid-time 2456610.863945 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,090 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Kammer et al. 2015, dayside brightness temperature at 3.6 µm (NASA Exoplanet Archive emission table)): #ff3f00. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of HAT-P-19's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (57, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-19b.json).


## Known problems

- **Orbit convention.** omega 256 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.07) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
