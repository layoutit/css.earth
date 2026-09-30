# HD 209458 b

HD 209458 b was the first planet seen crossing its star. It is a gas giant 1.36 times as wide as Jupiter. It opens on its thermal colour; a second dataset maps its heat by longitude from a published Spitzer phase curve.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Measured, from Torres et al. 2008, ApJ 677, 1324 (2008), arXiv:0801.1841: radius 1.359 +0.016 −0.019 Jupiter radii, period 3.524746 days, inclination 86.71 degrees, scaled distance a/R* = 8.76. The transit time, T0 = BJD_TDB 2459893.75120 ± 0.00005, is measured here from the JWST NIRCam F322W2 white-light curve of programme 1274 observation 2 (MAST product jw01274-o002_t002_nircam_f322w2-grismr-subgrism64_whtlt.ecsv), by a trapezoid fit; the paper gives no transit time.

**Thermal colour (default dataset).** The colour of a black body at the 1,499 K the NASA Exoplanet Archive lists for the day side (Zellem et al. 2014, the maximum of their 4.5 µm phase curve), uniform over the disc and lit by the star ([thermal-color.json](source/photometry/thermal-color.json)).

**The map.** Zellem et al. (2014, [ApJ 790, 53](https://doi.org/10.1088/0004-637X/790/1/53); [arXiv:1405.5923](https://arxiv.org/abs/1405.5923)) observed a full orbit with Spitzer at 4.5 µm on 2010 January 17 to 21 (program 60021). They fitted the planet's light with one sinusoid, c1 cos(2πt/P) + c2 sin(2πt/P). Their table is transcribed in [phase-curve.json](source/science/zellem-2014/phase-curve.json).

**Independent reanalysis.** Dang et al. (2025, [AJ 169, 32](https://doi.org/10.3847/1538-3881/ad8dd7); [arXiv:2408.13308](https://arxiv.org/abs/2408.13308)) refit the same Spitzer data: offset 43 +5/−6° east, day side 1,420 ± 20 K and night side 1,010 +70/−80 K. It agrees with this map. It prints no fit coefficients, so it is not drawn.

Measured and not shown: mass, 0.685 (+0.015/−0.014) Jupiter masses (Torres et al. 2008, Table 5), and a transmission spectrum. Not measured and not shown: albedo, surface, rotation.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Processing

The paper does not say where t = 0 falls. Counted from mid-transit, their c1 = −0.0410% and c2 = 0.0354% put the curve's peak 40.8° before eclipse and its trough 40.8° before transit, as their Table 2 gives both; no other origin does. The Cowan & Agol (2008, [ApJ 678, L129](https://doi.org/10.1086/589232), equation 5) inversion turns that curve into one map of longitude, through the [`published-phase-curve-map`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.ts) format. The palette runs from 850 to 1,600 K in false colour.

The planet's intensity relative to the star's is 2J/rp², with rp = 0.12130, turned into a brightness temperature at 4.5 µm. The paper does not say which stellar spectrum it used; the star temperature that its deeper eclipse (0.1391%) and 1,443 K imply is 5,588 K.

The orbit is drawn circular. The ascending node at celestial north is a display convention. The rotation record, `cssearth-synchronous-rotation@1`, assumes the planet is tidally locked, as Zellem et al. do: longitude 0 faces the star.

## Evidence

| Quantity | This map | Zellem et al. (2014) |
| --- | --- | --- |
| Day side, at mid-eclipse | 1,443 K (sets the star's band temperature) | 1,443 ± 30 K, second eclipse (Table 3) |
| Maximum of the curve | 1,497 K, 1,523 ppm | 1,499 ± 15 K; 1.001527 ± 0.000036 (Tables 2, 3) |
| Minimum of the curve | 972 K, 439 ppm | 972 ± 44 K; 1.000443 −0.000067/+0.000068 (Tables 2, 3) |
| Peak before eclipse | 40.8° | 40.9 ± 6.0°, 9.6 ± 1.4 hours (Table 2, section 4.2) |
| Night side, at mid-transit | 1,052 K | not given |
| Hottest point on the map | 1,557 K at 40.8° east | — |
| Coldest point on the map | 867 K at 139.2° west | — |

[`published-phase-curve-map.test.mts`](../../../packages/bake/src/objects/raster/eclipse-map/published-phase-curve-map.test.mts) integrates the map over the visible hemisphere and gets the Fourier curve back to 1e-9. It holds the dataset to the table above.

## Known problems

- **Longitude only.** A phase curve cannot see north and south, so the map is a band that varies only with longitude. Real hot Jupiters are cooler toward the poles.
- **Only the largest pattern is real.** The fit has one sinusoid. Nothing finer than a hemisphere is measured.
- **Brightness temperature, not temperature.** Each value is the temperature of a black body with the observed 4.5 µm brightness, against a star temperature the paper's own numbers imply.
- **Residual systematics.** The paper notes bumps in its light curve before the first eclipse and near phase 0.2, likely instrumental. The fit does not model them.
- **The colour dataset is not the map.** The thermal colour is one temperature, 1,499 K, over the whole disc.
- **Assumptions of the frame.** Tidal locking and a pole on the orbit normal are assumed. The transit time is our own measurement from one JWST visit. The planet is a sphere.
