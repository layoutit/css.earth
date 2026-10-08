# KELT-1 b

## Sources

It is the only planet known around KELT-1. Its orbit and size follow Siverd et al. 2012's fit, the archive's default. The introduction is generated from Siverd et al. 2012's published values; the sections below are the data's own.

**Size and mass.** Radius 1.11 Jupiter radii from Siverd et al. 2012 (2012ApJ...761..123S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2012ApJ...761..123S/abstract): 79,356.1 km at 71,492 km per Jupiter radius. GM from the mass 27.23 Jupiter masses (Siverd et al. 2012, the mass the NASA Exoplanet Archive's composite table adopts (2012ApJ...761..123S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2012ApJ...761..123S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 1.2174936 d Siverd et al. 2012 (2012ApJ...761..123S), via the NASA Exoplanet Archive ps table (pl_refname SIVERD_ET_AL__2012): a/R* derived from its semi-major axis 0.02466 au and stellar radius 1.471 solar radii; Siverd et al. 2012 (2012ApJ...761..123S), via the NASA Exoplanet Archive ps table (pl_refname SIVERD_ET_AL__2012): inclination 87.8 degrees Siverd et al. 2012 (2012ApJ...761..123S), via the NASA Exoplanet Archive ps table (pl_refname SIVERD_ET_AL__2012): e 0.0099 Siverd et al. 2012 (2012ApJ...761..123S), via the NASA Exoplanet Archive ps table (pl_refname SIVERD_ET_AL__2012): omega 61 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460610.036941 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,943 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Deming et al. 2023, dayside brightness temperature at 3.6 µm (uniform reanalysis of Spitzer's eclipses, CDS J/AJ/165/104 table 2)): #ffb66a. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Spitzer heat map.** Bell et al. (2021)'s published fit to a Spitzer IRAC 4.5 µm phase curve (program 11095, first published by Beatty et al. (2019)) ([record](source/science/bell-2021/phase-curve.json)), drawn as a map of longitude without refitting: 800 to 3,500 K, hottest 4° east of noon. It has no north-south information.

**Charts.** The orbits of KELT-1's planets from above, from their hosted-orbit records, and its dayside emission, 5 bins from Beatty et al. 2017 in the archive's emissionspec table; its transit in 3 TESS sectors (17, 57, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-08: the map's record is Bell et al. (2021)'s row of preferred model parameters, read as [WASP-14 b's](../wasp-14b/README.md) is. The paper's night side was not an input: the map gives 1,283 K at mid-transit against the printed 1350 +230/-260 K, and its maximum falls 3.8° before eclipse, as printed (3.8 +6.8/-6.1° east).

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kelt-1b.json).


## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **Orbit convention.** omega 61 degrees is taken as Siverd et al. 2012 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0099) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
