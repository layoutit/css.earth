# Enceladus B8: partial native VIMS spectral observations

Qualified for two masked scalar surface layers: `ice-absorption` and
`infrared-ratio`. Six original Nantes calibrated/navigation pairs total
5,647,058 bytes. The two prepared float32 GeoTIFFs total 211,686 bytes.
Preparation uses one small offline process and adds no runtime derivation.

These products are source-backed spectral indices from selected observations.
They are not a corrected global composition map. Approximate source-center
registration is qualified locally; independent absolute spacecraft pointing
accuracy remains unresolved.

## Source and reuse

The [Nantes data policy](https://vims.univ-nantes.fr/about) explicitly licenses
all distributed data under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).
Credit: **NASA / Caltech-JPL / University of Arizona / Osuna-CNRS-Nantes Université**.
The archive requests research citations to [Brown et al. 2004](https://doi.org/10.1007/s11214-004-1453-x)
and [Le Mouélic et al. 2019](https://doi.org/10.1016/j.icarus.2018.09.017).
cssEarth derived the scalar indices and conservative masked projections.
No institutional endorsement is implied; no institutional logos are included.

The exact policy snapshot is `evidence/license-about.html`, SHA-256
`02f560a51d6e075f91264a56b6aad8c23cfca448a4c17f0b3f0408568bf175a9`.
Every numeric file, exact download URL, byte count and SHA-256 is recorded in
`source-receipt.json`; the preparation recipe verifies every pin before use.
Original observation pages and archived PDS labels accompany the cubes.

The [archive calibration documentation](https://vims.univ-nantes.fr/info/isis-calibration)
describes RC19 I/F calibration followed by a 5×5 noise filter with 2.5-sigma
thresholds and 3×3 local replacement of NULL pixels when dimensions permit.
**Those source-owned filtering and replacement operations are retained.**
The checked-in cubes are not raw, unfiltered detector measurements. This
converter adds no further spectral gap fill, smoothing or spatial averaging.
Each C/N pair's product identity, timestamps, sample/line dimensions, channel
and RC19 history are checked. Only required spectral planes are read.

## Six-observation cohort

Source URL pattern: `https://vims.univ-nantes.fr/cube/C<ID>_ir.cub` for calibrated
I/F and `https://vims.univ-nantes.fr/cube/N<ID>_ir.cub` for navigation. Metadata
is `https://vims.univ-nantes.fr/cube/<ID>`; `<ID>.lbl` is the archived PDS label.

| Observation | Native samples × lines | Date | Accepted native centers | Accepted center cells | Retained resolution, km/pixel |
| --- | ---: | --- | ---: | ---: | ---: |
| 1487299582_1 | 34 × 16 | 2005-02-17 | 150 | 121 | 13.09–13.29 |
| 1489049741_1 | 36 × 24 | 2005-03-09 | 498 | 452 | 6.93–7.21 |
| 1702362997_1 | 27 × 30 | 2011-12-12 | 321 | 282 | 17.18–18.00 |
| 1702361128_1 | 12 × 12 | 2011-12-12 | 100 | 81 | 12.77–12.91 |
| 1500061929_1 | 28 × 14 | 2005-07-14 | 292 | 233 | 6.77–7.01 |
| 1500061170_1 | 24 × 12 | 2005-07-14 | 143 | 115 | 9.81–9.92 |

The first two observations appear in Robidel et al. Figure 8. The 2011 pair
provides a separate broad hemisphere footprint; the July 2005 pair adds
southern coverage. The selected cohort is fixed, not an all-mission download.
The Figure 12 observation `1702359174_1` was not retrieved and is not silently
substituted or claimed as part of the cohort.

## Scalar definitions

`R_b` is the source RC19 I/F at one-based **IR-only** band `b`.
Native wavelengths are retained separately for each observation.

The dimensionless `ice-absorption` value is a fixed-channel 2 µm band-depth
index: `D = 1 − R70 / ((1−t) R58 + t R81)`, with
`t = (lambda70 − lambda58)/(lambda81 − lambda58)`.
The generic band-depth convention is `1 − band/continuum`; see
[Clark 1999, Spectroscopy of Rocks and Minerals](https://clarkvision.com/science/principles-of-spectroscopy-clark-1999/)
and [USGS spectral-analysis methods](https://pubs.usgs.gov/of/2003/ofr-03-128/ofr-03-128.html).
Our channel/shoulder selection is an authored fixed index, not a fit to the
absorption minimum and not a reproduction of Filacchione's published maps.
Native band 70 spans 2.01829–2.02488 µm in this cohort.

The dimensionless `infrared-ratio` is `median(R134, R135, R136) / R48`.
The near-3.1/1.65 µm ratio and three-channel Fresnel-peak median are supported
by [Robidel et al. 2020, section 4](https://arxiv.org/html/2006.00146#S4).
Here the denominator is explicitly the native channel near **1.66 µm**:
1.65586 µm in 2005 and 1.66246 µm in 2011. Peak channels span
3.08163–3.11501 µm and 3.08823–3.12161 µm respectively. There is no
common-wavelength spline resampling or application of the authors' photometric
model. Neither product estimates an abundance, crystallinity percentage,
grain size, temperature, terrain age, or geological activity.

Photometric correction is **none**. Phase, incidence/emission, grain properties,
temperature, spectral drift, archive filtering and noise can influence these
observed indices. Ratios do not generally eliminate those effects. Seams
between observations must not be interpreted as compositional boundaries.
The 3.1 µm channels are comparatively noisy; median filtering across three
channels reduces sensitivity to individual channels without providing a
statistical uncertainty or physical inversion. No thermal correction is claimed.

## Masks and approximate navigation transfer

N cubes contain phase, emission, incidence, latitude, longitude and pixel
resolution, in that verified order. The source
[ISIS phocube documentation](https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/phocube/phocube.html)
defines the unprojected camera coordinates as ocentric latitude and 0–360°
east longitude, in degrees; pixel resolution is in meters. The archive's
SPICE-based camera navigation supplies centers, not the original four detector
corner coordinates or an independent absolute pointing solution.

The geometry screen requires phase 10–120°, incidence/emission below 80°,
resolution below 20 km/pixel, and valid coordinate and source values. The
last two upper cuts follow Robidel's source selection; the phase and local
navigation checks are conservative preparer qualification policies. ISIS
Real special-pixel codes are missing; finite valid zeros or negative noise
are preserved whenever the metric denominator remains positive. Source NULL
and special-pixel handling follows the
[ISIS special-pixel definitions](https://isis.astrogeology.usgs.gov/7.2.0/Object/Developer/_special_pixel_8h.html).

Every retained center must pass a withheld-coordinate test. Its position is
predicted from its four diagonal neighbors; a sample/line Jacobian comes from
four other axial neighbors. The held-out center enters neither prediction nor
Jacobian. All nine native cells must pass geometry screening. Prediction
error may be at most **0.25 native sample/line pixels**, with a conditioned
Jacobian. Border centers without independent support are withheld. Of 1,957
geometry-screened centers, 1,504 pass this policy; the maximum retained error
is 0.249539 native pixels. This tests local interpolation consistency only.
It does not prove absolute pointing or actual physical detector-corner bounds.

Four adjacent accepted source centers bound an interior spherical cell.
Folded, degenerate, nonconvex and greater-than-15° edge cells are excluded.
Output centers must lie inside one of its spherical triangles. They retain
the exact nearest archive-native vertex value; no numeric spatial
interpolation or support outside the center polygon is added. A missing
vertex invalidates the whole cell. This is a conservative approximate
center-footprint transfer, not a recovered exact detector footprint.

Overlaps prefer the cell's worst native resolution, then worst emission,
then fixed recipe observation and cell order. Science values do not decide
which observation wins. Both outputs retain 1,477 distinct archive-native
owners over 94,916 display pixels; 429,372 display pixels remain missing.
The latitude-weighted union estimates **23.7741% of the reference sphere**.
That is the area of accepted approximate footprints, not global measured
coverage or independent absolute positional accuracy.

Output is 1024×512 equirectangular Float32, north-up, −180…180° east, nodata
−9999, and reference radius 252100 m. The radius sets angular raster
coordinates; it does not replace body geometry or the native camera's source
ellipsoid. Display sampling is 0.3515625° (about 1.55 km at the equator),
distinct from native sampling of roughly 7–18 km. Empty regions must remain
missing in integration. The source-owner and source-pixel TIFFs are audit
planes, not public science layers.

## Evidence and reproducibility

- `prepare.json`: all pins, fixed cohort and policy, output paths.
- `preparation-receipt.json`: source wavelength/geometry/value statistics,
  holdout distributions, source and converter identities, TIFF hashes.
- `qualify.py`: independent struct byte decoding, scalar calculations and
  gnomonic polygon inclusion checks; does not import the converter.
- `qualification-receipt.json`: exact independent source-value matches for
  every 94,916 supported output samples per field, 192 independent source-cell
  containment probes per field, and concrete source-byte/coordinate anchors.
- `evidence/native-spectral-panels.png`: native source-grid scalar panels.
- `evidence/projected-spectral-panels.png`: partial output footprints. Both
  panels are scientific false-color illustrations with explicit fixed ranges.

Eight focused tests cover one-based bands/endian offsets, invalid source
values, valid zero/negative indices, spectral formulas, independent held-out
center rejection, spherical hemisphere/dateline support, missing-cell gaps,
source-value ownership and deterministic overlap policy. Numerical tests and
independent qualification pass. Image panels were visually inspected. Browser,
runtime and prepared object integration remain the parent task's responsibility.

Reproduction uses existing numpy/rasterio/Pillow dependencies, one process:
`python tools/objects/acquisition/enceladus-vims-spectral.py <recipe>`.
Run the adjacent `test_enceladus_vims_spectral.py` and then `qualify.py`.
No dependency installation, full object bake, application build or browser job
was run by this source lane.

## Other numerical releases reviewed

Robidel's original corrected global map was not found as a reusable numeric
release. Its [corrigendum](https://doi.org/10.1016/j.icarus.2020.113954), confirmed
by [the author HAL record](https://insu.hal.science/insu-03590082v1), corrects a
180° longitude-grid shift in Figures 9 and 11. Those original figure grids
are excluded as navigation references. The scalar data here come directly
from native C/N products, not those illustrations.

[NASA PIA24027](https://www.jpl.nasa.gov/images/pia24027-enceladus-in-the-infrared-map-view/)
is blended ISS/VIMS press imagery with removed seams/artifacts; it is not a
quantitative source. [Filacchione 2022](https://doi.org/10.1016/j.icarus.2021.114803)
describes 0.5° supplementary maps, but publisher retrieval returned 403 and
the [INAF author record](https://openaccess.inaf.it/entities/publication/30596495-3f2f-49f7-a7fb-a1aca47c3390)
provided only paper versions. The release remains unresolved, not proven
nonexistent. Combe's CO2 maps were likewise not located as reusable numerical
files. These are concrete future source-recovery candidates, not blockers to
the qualified native subset.

The 2026 [super-resolution software release](https://doi.org/10.5281/zenodo.21037588)
was resolved through DataCite metadata but its file list was not retrieved.
No learned or synthesized spatial detail is used as measured chemistry.
