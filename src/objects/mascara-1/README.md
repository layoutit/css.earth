# MASCARA-1

## Sources

It turns once in 0.85 days, which flattens it by 4.39%, and its planet's orbit is tilted 72 degrees from its equator. It is also HD 201585, HIP 104513. The introduction is from Hooton et al. (2022), A&A 658, A75; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 1744911763437512064, parallax 5.489 ± 0.024 mas (182.19 pc). Radius 2.051 solar radii, the volume-equivalent sphere of the fit below (the equator is 2.082). Mass 1.9 +/- 0.063 solar masses from Hooton et al. 2022, the stellar mass of the default parameter set of MASCARA-1 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...658A..75H/abstract). Temperature 7,490 K from Hooton et al. 2022, the stellar temperature of the default parameter set of MASCARA-1 b in the NASA Exoplanet Archive. log g 4.08 from the mass and Hooton et al. 2022's radius, 2.082 solar radii, the sphere the limb law was read for.

**Color.** Gaia DR3 XP spectrum, source 1744911763437512064, through the CIE 1931 2° observer: #cdd9ff. Routes tried in order: stis-ngsl: HD 201585 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 7,490 K and log g 4.08 (u1 0.277, u2 0.347): a model, because no fit of this star's limb is used.

**Shape.** Hooton et al. (2022, [A&A 658, A75](https://doi.org/10.1051/0004-6361/202141645); [arXiv:2109.05031](https://arxiv.org/abs/2109.05031)) fitted the uneven CHEOPS transits of [MASCARA-1 b](../mascara-1b/README.md), with the Spitzer ones, with a flattened, gravity-darkened star. Table 5 gives the equatorial radius, 2.082 (+0.022, -0.024) solar radii, and the oblateness, 0.0439 +/- 0.0018: the polar radius is that fraction smaller (section 4.1). The outline is the equator and the geometry's polar radius is 248 x (1 - 0.0439) units. The record's radius is the volume-equivalent sphere, 2.051 solar radii, which MASCARA-1 b's orbit is measured against. The record is [gravity-darkening.json](source/photometry/gravity-darkening.json), each value with its table cell.

**Gravity darkening.** The color is shaded by latitude with the Roche-von Zeipel model of [KELT-9](../kelt-9/README.md) and the other fast spinners ([gravity-darkening.ts](../../../packages/bake/src/objects/stellar/gravity-darkening.ts)). The inputs are the paper's flattening, its exponent 0.199 and its pole at 7,490 K, both of which the paper fixes (section 5.1). The paper gives no fraction of break-up and no equatorial temperature. The Roche surface with that flattening turns at 0.520 of break-up, and its equator comes out at 7,218 K.

**Spin axis.** [rotation.json](source/preparation/rotation.json), `cssearth-measured-obliquity-pole@1`, builds the pole against MASCARA-1 b's orbit from the projected spin-orbit angle, -69.2 (+3.1, -3.4) degrees, and the stellar inclination, 55.5 (+2.3, -2.9) degrees from the line of sight (Table 5). The star turns in 0.853 days. With the orbit's 88.45 degrees these give a true spin-orbit angle of 72.1 degrees, the paper's 72.1 (+2.5, -2.4).

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

- [`gravity-darkening.test.mts`](../../../packages/bake/src/objects/stellar/gravity-darkening.test.mts) checks that the Roche surface built from the record has the paper's flattening and equatorial radius, and fixes the model's equator temperature.

## Known problems

- **The flattening is small.** The pole is 4.39% closer in than the equator and 272 K hotter in this model: the page looks close to a sphere.
- **A mirrored solution fits.** The paper's transits and tomography do not tell {b, i*, lambda} from {-b, -i*, -lambda}; the one its table prints is drawn. The axis's position angle on the sky is not measured: the pole is placed against the planet's orbit, whose own orientation on the sky is a convention.
- **The pole temperature and the exponent are not fitted.** The paper fixes both.
- **The planet's orbit is drawn 1.5% smaller than before.** It is kept in stellar radii (4.1676, Hooton et al. 2022) against this record's radius, now the volume-equivalent 2.051 solar radii where it was the equatorial 2.082.
- **Made by hand.** This package was generated and is now edited by hand, as KELT-9's was written; it keeps no stored spec, so `new-object --refresh` refuses it.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HD 201585" (revision 1324636195) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
