# Tethys source selection

Status: source qualification and preparation complete. The detector-filtered
infrared and ice maps are prepared; see the [B9 README](../README.md) and final
packaged preparation receipts for coverage and current qualification. Absolute
registration remains limited as described below. The table distinguishes the
initial candidate assessment from the final detector-aperture and raw-quality
disposition.

The [Nantes targeted TE gallery](https://vims.univ-nantes.fr/flyby/TE) contains
17 cubes, but its flyby closest approach is not their observation resolution.
The reviewed September 2005 cubes are roughly 217–222 km/pixel, and three listed
entries were acquired in February 2006. They are excluded from this surface
cohort. Flyby membership alone cannot select an acquisition.

[Stephan et al. 2016](https://doi.org/10.1016/j.icarus.2016.03.002), section 2.2
and Table 1, identifies better non-targeted observations. The author's
[available manuscript](https://openaccess.inaf.it/bitstream/20.500.12386/24722/1/Stephan_Tethys_11092015.pdf)
provides independent region/illumination context for orbit 47 (Ithaca Chasma),
orbit 136 and orbit 168 (Odysseus). It does not supply the numeric maps used here.
Our candidate observations retain the Nantes RC19 calibration and original
navigation, rather than reproducing the author's older mapped dataset.

## Complete originals downloaded for qualification

Each ID links to an original calibrated C cube and navigation N cube through its
archive page. Complete byte counts, resolved URLs and SHA256s are recorded in
the local intake's `native/download-receipts.json` and copied beside the final body recipe under `source/cassini-ice/evidence`.

| Observation | Native dimensions | Approximate resolution | Initial assessment and final disposition |
| --- | --- | --- | --- |
| [1561668191_1](https://vims.univ-nantes.fr/cube/1561668191_1) | 28 × 14 | 12 km/pixel | Orbit 47 regional observation near Ithaca Chasma; actual detector support contributes both maps. |
| [1606213356_1](https://vims.univ-nantes.fr/cube/1606213356_1) | 24 × 18 | 27 km/pixel | Southern view at high phase; only valid, illuminated interior support may contribute. |
| [1660463972_1](https://vims.univ-nantes.fr/cube/1660463972_1) | 24 × 12 | 26 km/pixel | Orbit 136 southern trailing-side observation; contributes ice absorption, while detector quality excludes its RGB contribution. |
| [1719613772_1](https://vims.univ-nantes.fr/cube/1719613772_1) | 32 × 17 | 33 km/pixel | Orbit 168 leading-side observation; contributes ice absorption, while detector quality excludes its RGB contribution. No resolved Odysseus-center claim. |
| [1719616836_1](https://vims.univ-nantes.fr/cube/1719616836_1) | 32 × 17 | 36 km/pixel | Complementary orbit 168 observation; contributes both maps under deterministic ownership. |
| [1807473499_1](https://vims.univ-nantes.fr/cube/1807473499_1) | 24 × 12 | 26 km/pixel | 2015 orbit 214 anti-Saturn observation; promising signal. |
| [1818547570_1](https://vims.univ-nantes.fr/cube/1818547570_1) | 32 × 16 | 23 km/pixel | 2015 orbit 220 high-phase candidate; illumination remains in the measurements. |
| [1807456038_1](https://vims.univ-nantes.fr/cube/1807456038_1) | 3 × 48 | 34 km/pixel | Narrow scan; its shape and coverage require actual detector footprints. |
| [1807469104_1](https://vims.univ-nantes.fr/cube/1807469104_1) | 3 × 64 | 25 km/pixel | The initial neighbor-cell mapper admitted none; the final detector-aperture mapper retains seven source pixels in both maps. |

All nine observations contribute ice absorption; seven contribute infrared.
The final masks and counts supersede the initial neighbor-cell experiment.

Archive navigation uses Tethys frame **10041**, target **603**, and ellipsoid
**540.4 × 531.1 × 527.5 km**. Longitude is east-positive and latitude
planetocentric. These coordinates must be registered to the existing fixed
Tethys scene; these axes do not replace its retained geometry.

For the 2015 cubes, selected native IR channels 25, 44, 58, 70 and 81 are
1.28772, 1.59935, 1.82992, 2.02759 and 2.20940 µm. Earlier cubes must retain
their own exact centers. Two 2015 labels use ISIS end-of-line hyphen continuation
inside decimal numbers; this is handled using the documented
[ISIS PvlKeyword convention](https://isis.astrogeology.usgs.gov/3.5.0/Object/Programmer/_pvl_keyword_8cpp_source.html),
not by substituting the portal's preview wavelengths. The unwrapped 2015 labels
provide an independent same-date wavelength-array comparison.

RGB represents measured channels near 2.02, 1.59 and 1.28 µm. The ice
quantity is `1 − R70 / linear(R58, R81)` using each cube's wavelengths. It is
a continuum-relative absorption index, not ice abundance. No photometric
normalization or conversion to normal albedo is claimed. Keep noise, source
filtering, scan gaps and missing coverage explicit.

## Corrected alternatives

See [the corrected-release review](tethys-corrected-release.md). Filacchione et
al. 2022's numerical Tethys photometric coefficient table was retrieved from the
publisher and pinned. Its geographic arrays remain unresolved. The coefficients
were derived using RC17; compatibility with these RC19 observations has not been
established, so they are not applied speculatively.

## Completed source checks and remaining registration limit

The final maps use actual per-pixel detector support. Iapetus qualification
demonstrated that smooth navigation centers can still have large gaps between
scan lines; a neighbor holdout is not proof of continuous observation. The
[detector-quality review](tethys/DETECTOR-QUALITY.md) and
[aperture audit](iapetus/rasterizer-review.md) record the calibrated units,
band identities, per-band exclusions, source timing/rays, physical aperture
and sampled exposure-motion checks.

The [regional-framing review](tethys/REGIONAL-FRAMING.md) supports broad source
region descriptions, but the exact-USGS brightness comparison is
non-diagnostic for absolute alignment. No local offset or precise landmark
registration is inferred. The prepared views retain an explicit approximate
registration limit; stronger absolute alignment would require independent
measured feature ties.
