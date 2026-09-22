# Beta Pictoris

Beta Pictoris is an A6V star 19.6 parsecs away, about 23 million years old, seen through its own edge-on disc of dust. Three giant planets are imaged around it, and its planet b is the first exoplanet whose radio emission has been heard.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

**Placement.** The Gaia DR3 position, proper motion, parallax and radial velocity of source 4792774797545800832, archived as `photometry/gaia-dr3-source.csv`: parallax 50.9307 ± 0.1482 mas, 19.6345 pc with no zero-point correction. The star is bright for Gaia (G = 3.82, RUWE 3.07). The package binds to the star the shared star field already draws through its Hipparcos number, 27321, so there is one Beta Pictoris, not two.

**Radius.** The VLTI/VINCI limb-darkened angular diameter 0.736 ± 0.015 ± 0.012 mas of Di Folco et al. (2004, A&A 426, 601, Table 3), at the Gaia distance: 1.554 solar radii. The star is only 14% resolved by VINCI. Zwintz et al. (2019) derive 1.538 ± 0.040 from the same diameter at the Hipparcos parallax and 1.497 ± 0.025 from their seismic model; Gaia DR3 FLAME gives 1.568. **Mass**, for the display GM: 1.75 ± 0.03 solar masses, dynamical, from the planets' orbits (Lacour et al. 2021, Table 2).

**Rotation.** No period is adopted. Kraus et al. (2020) measure the spin axis in projection with GRAVITY, aligned with the disc and planet b's orbit to 3° ± 4°, and Zwintz et al. (2019) fit a near equator-on inclination from the pulsations; neither is a period. The display axis is celestial north at the star, a convention.

**Colour lens.** The colour of Gaia DR3's externally calibrated BP/RP sampled spectrum of the star, weighted by the CIE 1931 2° observer from 380 to 780 nm and converted to sRGB with the D65 white ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#c2d4ff**, the hue Fomalhaut's ground-based spectrum gives. The disc is darkened toward its edge by the quadratic V-band law Claret & Bloemen (2011) compute from ATLAS model atmospheres, read at 8090 K (Zwintz et al. 2019) and log g 4.30 (from the mass and radius): a model, not a measurement of this star.

**Debris disc.** Two datasets draw the attached volume [beta-pictoris-disc](../beta-pictoris-disc/README.md): Hubble's visible-light image from 16 to 82 au, where planet d orbits, and JWST's 2.1 and 4.1 µm images from 49 to 126 au.

**Planets.** [b](../beta-pictoris-b/README.md), [c](../beta-pictoris-c/README.md) and [d](../beta-pictoris-d/README.md), each on its measured orbit about this star.

## Evidence

Run of 2026-09-22 (this version):

- `node tools/prepare/prepare-object.mts beta-pictoris` prepared the package through its world step; its shared provenance step stops on the Large Magellanic Cloud's recipe pin, which is inconsistent on main itself (see the PR).
- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #c2d4ff is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity.
- Dev server `/beta-pictoris/` renders the star in its Gaia colour with no console errors.

## Known problems

- No image of the photosphere exists; the disc is 0.74 mas across.
- The limb darkening is a model.
- No rotation period is adopted; the display axis is a convention.
- Gaia's astrometry of so bright a star has a high RUWE (3.07); the parallax agrees with Hipparcos (51.44 ± 0.12 mas, the value the planets' orbits were fitted at) to 1%.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
