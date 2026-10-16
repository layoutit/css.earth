# WASP-4 b

## Sources

It is the only planet known around WASP-4. Its orbit and size follow Baştürk et al. 2025's fit, the archive's default. The introduction is generated from Baştürk et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 1.349 Jupiter radii from Baştürk et al. 2025 (2025MNRAS.541..714B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025MNRAS.541..714B/abstract): 96,442.7 km at 71,492 km per Jupiter radius. GM from the mass 1.2 Jupiter masses (Baştürk et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025MNRAS.541..714B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025MNRAS.541..714B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): P 1.33823136361 d Baştürk et al. 2025 (2025MNRAS.541..714B), via the NASA Exoplanet Archive ps table (pl_refname BA_AMP__351_T_AMP_UUML_RK_ET_AL__2025): a/R* 5.411; Baştürk et al. 2025 (2025MNRAS.541..714B), via the NASA Exoplanet Archive ps table (pl_refname BA_AMP__351_T_AMP_UUML_RK_ET_AL__2025): inclination 88.05 degrees Baluev et al. 2020 (2020MNRAS.496L..11B), via the NASA Exoplanet Archive ps table (pl_refname BALUEV_ET_AL__2020): e 0.0053 Baluev et al. 2020 (2020MNRAS.496L..11B), via the NASA Exoplanet Archive ps table (pl_refname BALUEV_ET_AL__2020): omega 247 degrees Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): transit mid-time 2455804.51567913 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,995 K dayside brightness temperature measured in secondary eclipse at 2.2 µm (Cáceres et al. 2011, dayside brightness temperature at 2.2 µm (NASA Exoplanet Archive emission table)): #ff8a15. Chosen from the archive's emission rows by rule: 3 measured of 4 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of WASP-4's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (103, 105, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-4b.json).


## Known problems

- **Orbit convention.** omega 247 degrees is taken as Baluev et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0053) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-4b" (revision 1374393052) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
