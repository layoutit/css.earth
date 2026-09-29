# WASP-6 b

## Sources

It is the only planet known around WASP-6. Its orbit and size follow McGruder et al. 2023's fit, the archive's default. This account was drafted from McGruder et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 1.119 Jupiter radii from McGruder et al. 2023 (2023ApJ...944L..56M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023ApJ...944L..56M/abstract): 79,999.5 km at 71,492 km per Jupiter radius. GM from the mass 0.467 Jupiter masses (McGruder et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023ApJ...944L..56M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023ApJ...944L..56M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): P 3.36100237 d McGruder et al. 2023 (2023ApJ...944L..56M), via the NASA Exoplanet Archive ps table (pl_refname MCGRUDER_ET_AL__2023): a/R* 11.21; McGruder et al. 2023 (2023ApJ...944L..56M), via the NASA Exoplanet Archive ps table (pl_refname MCGRUDER_ET_AL__2023): inclination 89 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.054 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 1.7 degrees Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): transit mid-time 2456132.410973 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** A black body at the 1,235 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Kammer et al. 2015, dayside brightness temperature at 3.6 µm (NASA Exoplanet Archive emission table)): #ff5300. Chosen from the archive's emission rows by rule: 2 measured of 2 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of WASP-6's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (2, 29, 69), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-6b.json).


## Known problems

- **Orbit convention.** omega 1.7 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.054) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "WASP-6b" (revision 1374239422), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
