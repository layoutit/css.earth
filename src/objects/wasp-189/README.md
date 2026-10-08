# WASP-189

## Sources

It turns once in 1.2 days, which flattens it by 2.88%, and its planet's orbit passes over its poles. It is also HD 133112, HR 5599, HIP 73608. The introduction is from Deline et al. (2022), A&A 659, A74; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6339097679918871168, parallax 10.100 ± 0.029 mas (99.01 pc). Radius 2.340 solar radii, the volume-equivalent sphere of the fit below (the equator is 2.363). Mass 2.03 +/- 0.066 solar masses from Lendl et al. 2020, the stellar mass of the default parameter set of WASP-189 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...643A..94L/abstract). Temperature 8,000 K from Lendl et al. 2020, the stellar temperature of the default parameter set of WASP-189 b in the NASA Exoplanet Archive. log g 4 from the mass and Lendl et al. 2020's radius, 2.36 solar radii, the sphere the limb law was read for.

**Color.** Gaia DR3 XP spectrum, source 6339097679918871168, through the CIE 1931 2° observer: #c9d6ff. Routes tried in order: stis-ngsl: HD 133112 is not in the library; pulkovo: HR 5599 is not in the catalogue; kiehling: HR 5599 is not among its 60 stars; kharitonov: HR 5599 is not in the catalogue; burnashev: BS 5599 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 8,000 K and log g 4 (u1 0.313, u2 0.327): a model, because no fit of this star's limb is used.

**Shape.** Deline et al. (2022, [A&A 659, A74](https://doi.org/10.1051/0004-6361/202142400); [arXiv:2201.04518](https://arxiv.org/abs/2201.04518)) fitted the uneven CHEOPS transits of [WASP-189 b](../wasp-189b/README.md) with a flattened, gravity-darkened star. Table 3 gives the equatorial radius, 2.363 (+0.025, -0.024) solar radii, and the oblateness, 2.88 (+0.15, -0.12) %: the polar radius is that much smaller (section 4.4.1). The outline is the equator and the geometry's polar radius is 248 x (1 - 0.0288) units. The record's radius is the volume-equivalent sphere, 2.340 solar radii, which WASP-189 b's orbit is measured against. The record is [gravity-darkening.json](source/photometry/gravity-darkening.json), each value with its table cell.

**Gravity darkening.** The color is shaded by latitude with the Roche-von Zeipel model of [KELT-9](../kelt-9/README.md) and the other fast spinners ([gravity-darkening.ts](../../../packages/bake/src/objects/stellar/gravity-darkening.ts)). The inputs are the paper's flattening, its exponent 0.22, which it fixes from Claret (2016), and its fitted pole, 7,967 (+69, -67) K. The paper gives no fraction of break-up and no equatorial temperature. The Roche surface with that flattening turns at 0.428 of break-up, and its equator comes out at 7,760 K, 207 K under the pole; the paper says about 200 K (section 5.1).

**Spin axis.** [rotation.json](source/preparation/rotation.json), `cssearth-measured-obliquity-pole@1`, builds the pole against WASP-189 b's orbit from the projected obliquity, 91.7 +/- 1.2 degrees, and the stellar inclination, 68.2 +/- 1.6 degrees from the line of sight (Table 3). The star turns in 1.198 days. With the orbit's 84.03 degrees these give a true obliquity of 89.4 degrees, inside the paper's 89.6 +/- 1.2.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- [`gravity-darkening.test.mts`](../../../packages/bake/src/objects/stellar/gravity-darkening.test.mts) checks that the Roche surface built from the record has the paper's flattening and equatorial radius, and fixes the model's equator temperature.

## Known problems

- **The flattening is small.** The pole is 2.88% closer in than the equator and 207 K hotter: the page looks close to a sphere.
- **Two orientations fit.** The paper draws two orientations of the system that its transits do not tell apart (section 5.1); the one its table prints is drawn. The axis's position angle on the sky is not measured: the pole is placed against the planet's orbit, whose own orientation on the sky is a convention.
- **The planet's orbit is drawn 0.8% smaller than before.** It is kept in stellar radii (4.6, Lendl et al. 2020) against this record's radius, now the volume-equivalent 2.340 solar radii where it was 2.36.
- **Made by hand.** This package was generated and is now edited by hand, as KELT-9's was written; it keeps no stored spec, so `new-object --refresh` refuses it.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "WASP-189 b" (revision 1374244884) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
