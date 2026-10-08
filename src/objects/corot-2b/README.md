# CoRoT-2 b

## Sources

It is the only planet known around CoRoT-2. Its orbit and size follow Gillon et al. 2010's fit, the archive's default. The introduction is generated from Gillon et al. 2010's published values; the sections below are the data's own.

**Size and mass.** Radius 1.466 Jupiter radii from Gillon et al. 2010 (2010A&A...511A...3G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2010A&A...511A...3G/abstract): 104,807.3 km at 71,492 km per Jupiter radius. GM from the mass 3.47 Jupiter masses (Gillon et al. 2010, the mass the NASA Exoplanet Archive's composite table adopts (2010A&A...511A...3G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2010A&A...511A...3G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): P 1.74299845482 d Gillon et al. 2010 (2010A&A...511A...3G), via the NASA Exoplanet Archive ps table (pl_refname GILLON_ET_AL__2010): a/R* derived from its semi-major axis 0.02798 au and stellar radius 0.906 solar radii; Gillon et al. 2010 (2010A&A...511A...3G), via the NASA Exoplanet Archive ps table (pl_refname GILLON_ET_AL__2010): inclination 88.08 degrees Gillon et al. 2010 (2010A&A...511A...3G), via the NASA Exoplanet Archive ps table (pl_refname GILLON_ET_AL__2010): e 0.0143 Gillon et al. 2010 (2010A&A...511A...3G), via the NASA Exoplanet Archive ps table (pl_refname GILLON_ET_AL__2010): omega 102 degrees Sodickson & Grunblatt 2025 (2025ApJ...993...78S), via the NASA Exoplanet Archive ps table (pl_refname SODICKSON__AMP__GRUNBLATT_2025): transit mid-time 2454237.53237614 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,890 K dayside brightness temperature measured in secondary eclipse at 2.15 µm (Alonso et al. 2010, dayside brightness temperature at 2.15 µm (NASA Exoplanet Archive emission table)): #ff8400. Chosen from the archive's emission rows by rule: 1 measured of 6 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Spitzer heat map.** Bell et al. (2021)'s published fit to a Spitzer IRAC 4.5 µm phase curve (program 11073, first published by Dang et al. (2018)) ([record](source/science/bell-2021/phase-curve.json)), drawn as a map of longitude without refitting: 350 to 2,000 K, hottest 39° west of noon. It has no north-south information.

**Charts.** The orbits of CoRoT-2's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (54, 81), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-08: the map's record is Bell et al. (2021)'s row of preferred model parameters, read as [WASP-14 b's](../wasp-14b/README.md) is. The paper's night side was not an input: the map gives 884 K at mid-transit against the printed 873 +51/-41 K, and its maximum falls 38.7° after eclipse, as printed (-38.7 ± 3.2° east).

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/corot-2b.json).


## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **A companion star's light.** The paper corrects this system for the light of CoRoT-2 B. That the table's depth and radius ratio carry the correction is this record's reading; the temperatures are anchored on the printed day side either way.
- **Orbit convention.** omega 102 degrees is taken as Gillon et al. 2010 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0143) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "CoRoT-2b" (revision 1374889179) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
