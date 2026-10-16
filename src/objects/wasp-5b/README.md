# WASP-5 b

## Sources

It is the only planet known around WASP-5. Its orbit and size follow Gillon et al. 2009's fit, the archive's default. The introduction is generated from Gillon et al. 2009's published values; the sections below are the data's own.

**Size and mass.** Radius 1.087 Jupiter radii from Gillon et al. 2009 (2009A&A...496..259G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009A&A...496..259G/abstract): 77,711.8 km at 71,492 km per Jupiter radius. GM from the mass 1.58 Jupiter masses (Gillon et al. 2009, the mass the NASA Exoplanet Archive's composite table adopts (2009A&A...496..259G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2009A&A...496..259G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): P 1.62842992377 d Gillon et al. 2009 (2009A&A...496..259G), via the NASA Exoplanet Archive ps table (pl_refname GILLON_ET_AL__2009): a/R* derived from its semi-major axis 0.0267 au and stellar radius 1.029 solar radii; Gillon et al. 2009 (2009A&A...496..259G), via the NASA Exoplanet Archive ps table (pl_refname GILLON_ET_AL__2009): inclination 86.9 degrees Gillon et al. 2009 (2009A&A...496..259G), via the NASA Exoplanet Archive ps table (pl_refname GILLON_ET_AL__2009): e 0.038 Gillon et al. 2009 (2009A&A...496..259G), via the NASA Exoplanet Archive ps table (pl_refname GILLON_ET_AL__2009): omega 34.38 degrees Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): transit mid-time 2454373.99703619 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,996 K dayside brightness temperature measured in secondary eclipse at 1.22 µm (Chen et al. 2014, dayside brightness temperature at 1.22 µm (NASA Exoplanet Archive emission table)): #ffb76d. Chosen from the archive's emission rows by rule: 2 measured of 5 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of WASP-5's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (103, 105, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-5b.json).


## Known problems

- **Orbit convention.** omega 34.38 degrees is taken as Gillon et al. 2009 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.038) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-5b" (revision 1374239182) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
