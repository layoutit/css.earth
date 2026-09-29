# S2

## Sources

S2 is a hot young star on a 16-year orbit around Sagittarius A*, the black hole at the centre of the Milky Way. At its closest, in 2018, it passed 120 au from Sagittarius A*, four times Neptune's distance from the Sun. It is one of the S-stars described in the [Sagittarius A* README](../sgr-a-star/README.md#the-s-stars), and the first of them with a page of its own. This account was drafted from GRAVITY Collaboration (2022), A&A 657, L12's values; the sections below are the data's own.

**Size and mass.** Radius 5.53 (+1.77/-0.79) solar radii and mass 13.60 (+2.2/-1.8) solar masses from Habibi et al. (2017, ApJ 847, 120; arXiv:1708.06353), Table 3, model-atmosphere fit to SINFONI spectra (Teff 28513 K, B0-B3), at 695,700 km per solar radius and the JPL solar GM.

**Orbit.** Derived: Kepler's third law with a = 0.12495 arcsec x 8277 pc = 1034.21 au and the central mass 4.297e6 solar masses (GRAVITY 2022, Table 1): sqrt(1034.21^3 / 4.297e6) = 16.0447 yr of 365.25 d. The table prints no period. GRAVITY Collaboration (2022, A&A 657, L12), Table 1: a = 0.12495 +/- 0.00004 arcsec, placed at 8277 pc: 1034.2 au, 5131.4 shadow radii; e = 0.88441 +/- 0.00006; i = 134.70 +/- 0.03 degrees. Osculating elements. GRAVITY Collaboration (2022), Table 1: t_peri = 2018.3789 +/- 0.0001 yr. Decimal year taken as a Julian epoch, MJD = 51544.5 + (year - 2000.0) x 365.25; its time scale is taken as TDB (a difference of about a minute). GRAVITY Collaboration (2022), Table 1: Omega = 228.19 +/- 0.03 degrees. This is a Keplerian orbit: no relativistic precession is modelled. Orientation mapped by measurement: Gillessen et al. (2017, ApJ 837, 30; VizieR J/ApJ/837/30) table5 positions and radial velocities of S2 (145 positions, 44 radial velocities, 1992-2016) and S1 (161 positions) are reproduced by this package's hosted orbit with i and Omega as published and omega + 180 degrees (2.08 and 3.17 mas rms, 31.9 km/s rms for S2); every other mapping is off by 135-594 mas or 1551 km/s. The published omega is the star's own argument of periapsis; the hosted-orbit convention stores the host-side one, as the beta-pictoris records do. GRAVITY Collaboration (2022), Table 1: 0.88441 +/- 0.00006. GRAVITY Collaboration (2022), Table 1: omega = 66.25 +/- 0.03 degrees, the star's own; stored as 246.25.

**Colour.** A Planck spectrum at 28,513 K: #a3bcff, because S2 is observed only in the near-infrared (the SINFONI H- and K-band spectra of Habibi et al. 2017); no spectrum of it covers visible light. The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 28,513 K and log g 4.09 (u1 0.081, u2 0.284): a model, because no fit of this star's limb is used.

## Evidence

[The rendered page](evidence/rendered-page.png) (dev server, 900 × 900 headless Chromium, 2026-09-27): the disc at its Planck colour, dimmed toward the edge by the ATLAS limb law, with its neighbouring S-stars labelled.

Generated 2026-09-27 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/s2.json).


## Known problems

- **Keplerian orbit.** The orbit is a fixed ellipse. S2's orbit precesses by about 12 arcminutes per revolution; that is not drawn.
- **Record kept by its owner.** The orbit, radius and mass live in the S-star record that `packages/astronomy/cli/generate-s-stars.mts` writes. The package's spec cites the same values, and the generator refuses to write the package when the two disagree.
- **Drafted text.** The card and introduction were drafted for this package from GRAVITY Collaboration (2022)'s Table 1 values (the 120 au is a(1 − e) = 1034.2 au × 0.11559).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
