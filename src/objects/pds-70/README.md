# PDS 70

PDS 70 is a young K7 star 112 parsecs away in Centaurus, still surrounded by the disc it formed from. Two giant planets, [PDS 70 b](../pds-70-b/README.md) and [PDS 70 c](../pds-70-c/README.md), orbit inside a gap in that disc: planets caught while still forming. The [dust ring](../pds-70-disc/README.md) outside them is drawn from ALMA.

## Sources

**Placement.** Gaia DR3 source 6110141563309613056 (Gaia Collaboration 2023, A&A 674, A1): position at J2016.0, proper motion, and the parallax 8.8975 ± 0.0191 mas (RUWE 1.39), inverted to 112.39 pc with no zero-point correction ([source record](../../sources/gaia-dr3-pds-70.json)). The radial velocity, 0.74 ± 3.22 km/s, is Gaia's, the value SIMBAD adopts. SIMBAD gives the spectral type K7IVe (Pecaut & Mamajek 2016).

**Radius, temperature and mass.** 1.26 ± 0.15 solar radii and 3,972 ± 36 K from Keppler et al. (2018, A&A 617, A44; [arXiv:1806.11568](https://arxiv.org/abs/1806.11568)), Table 1; their radius is for 113.4 pc, 0.9% farther than Gaia DR3 puts the star, and is not rescaled. The mass is the dynamical 0.952 +0.032/−0.028 solar masses that Trevascus et al. (2025, A&A 698, A19; [arXiv:2504.11210](https://arxiv.org/abs/2504.11210)) fit together with the planets' orbits, so the orbits and the star agree.

**Colour lens.** Gaia publishes no BP/RP spectrum of this star, so the colour is from ESO's VLT/X-shooter: the wide-slit exposure of 26 December 2020 that the PENELLOPE programme (105.205R.001; Manara et al. 2021) takes for absolute flux calibration. X-shooter splits the light between arms; the UVB arm is used below 545 nm and the VIS arm above, and there the two agree to 2.3% ([stellar-color.json](source/photometry/stellar-color.json), read by [stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)). Weighted by the CIE 1931 2° observer from 380 to 780 nm with the D65 white, it is **#ffcb9b**. A 3,972 K blackbody gives #ffd3a4; K2-18, at 3,457 K, is #ffc796. The star is still accreting, and that light is part of the spectrum. The edge is darkened by the quadratic V-band law of Claret & Bloemen (2011) at 3,972 K and log g 4.22 (from the mass and radius above): a model, not a measurement of this star.

**Dust ring lens.** The [PDS 70 dust ring](../pds-70-disc/README.md) around the star in its own glow at 0.87 mm, from ALMA.

**Rotation.** None is adopted: the disc's axis is measured, but not the star's spin axis. The display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places both planets, at this star's Gaia distance and mass, where VLTI/GRAVITY measured them (see [PDS 70 b](../pds-70-b/README.md)); the astronomy package's 857 tests pass.
- The system view and the star in its colour, captured headless from the dev server of this version ([system](evidence/pds-70-system.png), [star](evidence/pds-70-star.png)).

## Known problems

- No second spectrum confirms the colour: Gaia has none, and the programme's other wide-slit night (8 March 2021) is refused because its two arms differ by 15.8% where they join.
- The limb darkening is a model atmosphere's, not measured on this star.
- The radial velocity is uncertain by 3 km/s.
- The proposed third planet, PDS 70 d, is not included ([ledger](investigations.json)).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
