# PDS 70

PDS 70 is a young K7 star 112 parsecs away in Centaurus, still surrounded by the disc it formed from. Two giant planets, [PDS 70 b](../pds-70-b/README.md) and [PDS 70 c](../pds-70-c/README.md), orbit inside a gap in that disc: planets caught while still forming. The [dust ring](../pds-70-disc/README.md) outside them is drawn from ALMA.

## Sources

**Placement.** Gaia DR3 source 6110141563309613056 (Gaia Collaboration 2023, A&A 674, A1): position at J2016.0, proper motion, and the parallax 8.8975 ± 0.0191 mas (RUWE 1.39), inverted to 112.39 pc with no zero-point correction ([source record](../../sources/gaia-dr3-pds-70.json)). The radial velocity, 0.74 ± 3.22 km/s, is Gaia's, the value SIMBAD adopts. SIMBAD gives the spectral type K7IVe (Pecaut & Mamajek 2016).

**Radius, temperature and mass.** 1.26 ± 0.15 solar radii and 3,972 ± 36 K from Keppler et al. (2018, A&A 617, A44; [arXiv:1806.11568](https://arxiv.org/abs/1806.11568)), Table 1; their radius is for 113.4 pc, 0.9% farther than Gaia DR3 puts the star, and is not rescaled. The mass is the dynamical 0.952 +0.032/−0.028 solar masses that Trevascus et al. (2025, A&A 698, A19; [arXiv:2504.11210](https://arxiv.org/abs/2504.11210)) fit together with the planets' orbits, so the orbits and the star agree.

**Color dataset.** Gaia publishes no BP/RP spectrum of this star, so the color is from ESO's VLT/X-shooter: the wide-slit exposure of 26 December 2020 that the PENELLOPE programme (105.205R.001; Manara et al. 2021) takes for absolute flux calibration. X-shooter splits the light between arms; the UVB arm is used below 545 nm and the VIS arm above, and there the two agree to 2.3% ([stellar-color.json](source/photometry/stellar-color.json), read by [stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)). Weighted by the CIE 1931 2° observer from 380 to 780 nm with the D65 white, it is **#ffcb9b**. A 3,972 K blackbody gives #ffd3a4; K2-18, at 3,457 K, is #ffc796. The star is still accreting, and that light is part of the spectrum. The edge is darkened by the quadratic V-band law of Claret & Bloemen (2011) at 3,972 K and log g 4.22 (from the mass and radius above): a model, not a measurement of this star.

**Dust ring dataset.** The [PDS 70 dust ring](../pds-70-disc/README.md) around the star in its own glow at 0.87 mm, from ALMA.

**Rotation.** None is adopted: the disc's axis is measured, but not the star's spin axis. The display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 11 and 102 (the newest of March and April 2026; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places both planets, at this star's Gaia distance and mass, where VLTI/GRAVITY measured them (see [PDS 70 b](../pds-70-b/README.md)); the astronomy package's 857 tests pass.
- The system view and the star in its color, captured headless from the dev server of this version (system, star).

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 11 gives a period of 3.04 d from the autocorrelation, whose peaks have a height of 0.33, a width of 0.48 and a fit of 1.00; Sector 102 gives a period of 3.03 d from the autocorrelation, whose peaks have a height of 0.24, a width of 0.45 and a fit of 0.98; 1 more of the star's 3 sectors does not meet the criteria. All 3 together give a period of 3.06 d from the autocorrelation, whose peaks have a height of 0.25, a width of 0.48 and a fit of 0.99, which is the star's period: 3.06 d. The light varies by 14% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 3.03 d from the catalogues. The map's light curve leaves a scatter of 2.5% about the light, whose own noise is 0.25%. Gaia DR3 lists 28 other stars within 63 arcseconds, with 8.0% of their light and the star's together.

## Known problems

- No second spectrum confirms the color: Gaia has none, and the programme's other wide-slit night (8 March 2021) is refused because its two arms differ by 15.8% where they join.
- The limb darkening is a model atmosphere's, not measured on this star.
- The radial velocity is uncertain by 3 km/s.
- The proposed third planet, PDS 70 d, is not included ([ledger](investigations.json)).

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at a tilt of 55.2°, worked out from the star's rotation speed, period and radius; the page draws the axis by convention. The map is of March and April 2026: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
