# WASP-19 b

## Sources

It is the only planet known around Wattle. Its orbit and size follow Cortés-Zuleta et al. 2020's fit, the archive's default. The introduction is generated from Cortés-Zuleta et al. 2020's published values; the sections below are the data's own.

**Size and mass.** Radius 1.415 Jupiter radii from Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...636A..98C/abstract): 101,161.2 km at 71,492 km per Jupiter radius. GM from the mass 1.154 Jupiter masses (Cortés-Zuleta et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020A&A...636A..98C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020A&A...636A..98C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): P 0.78883900702 d Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive ps table (pl_refname CORT_EACUTE_S_ZULETA_ET_AL__2020): a/R* 3.533; Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive ps table (pl_refname CORT_EACUTE_S_ZULETA_ET_AL__2020): inclination 79.08 degrees Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive ps table (pl_refname CORT_EACUTE_S_ZULETA_ET_AL__2020): e 0.0126 Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive ps table (pl_refname CORT_EACUTE_S_ZULETA_ET_AL__2020): omega 51 degrees Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): transit mid-time 2456402.71307265 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,346 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Anderson et al. 2013, dayside brightness temperature at 3.6 µm (NASA Exoplanet Archive emission table)): #ff9d3d. Chosen from the archive's emission rows by rule: 8 measured of 9 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of Wattle's planets from above, from their hosted-orbit records, and its transmission spectrum, 9 bins from Bean et al. 2013 in the archive's transitspec table, the most of its 2 papers; its transit in 3 TESS sectors (89, 90, 99), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-19b.json).


## Known problems

- **Orbit convention.** omega 51 degrees is taken as Cortés-Zuleta et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0126) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-19b" (revision 1374844406) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
