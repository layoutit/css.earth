# S6

## Sources

S6 is a hot young star on a 192-year orbit around Sagittarius A*, the black hole at the centre of the Milky Way. At its closest it passes 870 au from Sagittarius A*; it is next there in 2108. It is one of the S-stars described in the [Sagittarius A* README](../sgr-a-star/README.md#the-s-stars). The introduction is generated from Gillessen et al. (2017), ApJ 837, 30's published values; the sections below are the data's own.

**Size and mass.** Radius 4.51 (+1.79/-0.78) solar radii and mass 9.20 (+1.9/-1.5) solar masses from Habibi et al. (2017, ApJ 847, 120; arXiv:1708.06353), Table 3, model-atmosphere fit to SINFONI spectra (Teff 22932 K, B0-B3), at 695,700 km per solar radius and the JPL solar GM.

**Orbit.** Gillessen et al. (2017, ApJ 837, 30; VizieR J/ApJ/837/30), table3: P = 192.00 +/- 0.17 yr of 365.25 d. Gillessen et al. (2017, ApJ 837, 30; VizieR J/ApJ/837/30), table3: a = 0.6574 +/- 0.0006 arcsec, placed at 8277 pc: 5441.3 au, 26997.9 shadow radii; e = 0.8400 +/- 0.0003; i = 87.24 +/- 0.06 degrees. Gillessen et al. (2017), table3: Tp = 2108.61 +/- 0.03 yr. Decimal year taken as a Julian epoch, MJD = 51544.5 + (year - 2000.0) x 365.25; its time scale is taken as TDB (a difference of about a minute). Gillessen et al. (2017), table3: Omega = 85.07 +/- 0.12 degrees. Their fit used R0 = 8320 pc; the angular elements are placed at 8277 pc like the rest of this system. Orientation mapped by measurement: Gillessen et al. (2017, ApJ 837, 30; VizieR J/ApJ/837/30) table5 positions and radial velocities of S2 (145 positions, 44 radial velocities, 1992-2016) and S1 (161 positions) are reproduced by this package's hosted orbit with i and Omega as published and omega + 180 degrees (2.08 and 3.17 mas rms, 31.9 km/s rms for S2); every other mapping is off by 135-594 mas or 1551 km/s. The published omega is the star's own argument of periapsis; the hosted-orbit convention stores the host-side one, as the beta-pictoris records do. Gillessen et al. (2017), table3: 0.8400 +/- 0.0003. Gillessen et al. (2017), table3: omega = 116.23 +/- 0.07 degrees, the star's own; stored as 296.23. Gillessen et al. (2017), Sect. 3.4.1: an orbit constrains the central mass only with at least 8 measured dynamical quantities including a radial-velocity term; the 17 orbits fitted together are S2, S1, S4, S8, S9, S12, S13, S14, S17, S18, S19, S21, S24, S31, S38, S54, S55. S6 is not among them and GRAVITY (2022) does not refit it, so its path is not drawn.

**Color.** A Planck spectrum at 22,932 K: #a7bfff, because S6 is observed only in the near-infrared (the SINFONI H- and K-band spectra of Habibi et al. 2017); no spectrum of it covers visible light. The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 22,932 K and log g 4.09 (u1 0.104, u2 0.272): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/s6.json).

## Known problems

- **Keplerian orbit.** The orbit is a fixed ellipse: no relativistic precession is modelled.
- **Orbit path not drawn.** Gillessen et al. (2017), Sect. 3.4.1: an orbit constrains the central mass only with at least 8 measured dynamical quantities including a radial-velocity term; the 17 orbits fitted together are S2, S1, S4, S8, S9, S12, S13, S14, S17, S18, S19, S21, S24, S31, S38, S54, S55. S6 is not among them and GRAVITY (2022) does not refit it, so its path is not drawn. The star is placed on its published orbit.
- **Record kept by its owner.** The orbit, radius and mass live in the S-star record that `packages/astronomy/cli/generate-s-stars.mts` writes. The package's spec cites the same values, and the generator refuses to write the package when the two disagree.
- **Drafted text.** The card and introduction were drafted for this package from Gillessen et al. (2017)'s table3 values (the 870 au is a(1 − e) = 5441.3 au × 0.16).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
