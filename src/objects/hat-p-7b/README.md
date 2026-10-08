# HAT-P-7 b

## Sources

It is the only planet known around HAT-P-7. Its orbit and size follow Stassun et al. 2017's fit, the archive's default. The introduction is generated from Stassun et al. 2017's published values; the sections below are the data's own.

**Size and mass.** Radius 1.51 Jupiter radii from Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract): 107,952.9 km at 71,492 km per Jupiter radius. GM from the mass 1.84 Jupiter masses (Stassun et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017AJ....153..136S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017AJ....153..136S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): P 2.2047354 d Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): a/R* 4.13; Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): inclination 83.11 degrees Stassun et al. 2017 (2017AJ....153..136S), via the NASA Exoplanet Archive ps table (pl_refname STASSUN_ET_AL__2017): e 0 Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): transit mid-time 2454954.35847 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 3,100 K dayside brightness temperature measured in secondary eclipse at 8 µm (Christiansen et al. 2010, dayside brightness temperature at 8 µm (NASA Exoplanet Archive emission table)): #ffbb74. Chosen from the archive's emission rows by rule: 4 measured of 4 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Spitzer heat map.** Bell et al. (2021)'s published fit to a Spitzer IRAC 4.5 µm phase curve (program 60021, first published by Wong et al. (2016)) ([record](source/science/bell-2021/phase-curve.json)), drawn as a map of longitude without refitting: 2,200 to 3,250 K, hottest 57° west of noon. It has no north-south information.

**Charts.** The orbits of HAT-P-7's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (75, 81, 82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-08: the map's record is Bell et al. (2021)'s row of preferred model parameters, read as [WASP-14 b's](../wasp-14b/README.md) is. The paper's night side was not an input: the map gives 2,503 K at mid-transit against the printed 2520 +240/-290 K, and its maximum falls 57° after eclipse, as printed (-57 +23/-19° east).

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-7b.json).


## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **An unusually flat curve.** Bell et al. (2021) say their models prefer "an unusually flat phase curve compared to the literature" for HAT-P-7 b and that the offset becomes undefined as the amplitude nears zero; they find a large spread of offsets between their detector models. The 57° west of this map is weakly held.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-7b" (revision 1374221277) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
