# Dione and Rhea: Cassini VIMS interpretation

The four B7 views use the unweighted Cassini VIMS mosaics from Scipioni and
Combe's [PDS collection, DOI 10.17189/ctqe-ta30](https://doi.org/10.17189/ctqe-ta30).
Infrared is a false-color display of three measured spectral channels. Water-ice
absorption is a new, explicitly defined continuum-relative indicator derived
from those archived reflectance spectra. It is not a measurement of ice
percentage, crystallinity, grain size, elevation or temperature.

## Original products

The official [PDS collection page](https://pds.nasa.gov/ds-view/pds/viewCollection.jsp?identifier=urn:nasa:pds:dione.rhea_cassini_vims_ir-mosaic_scipioni_2022:data&version=1.0)
links the USGS archive. Its current Individual Investigations object service is
`https://dwjtvz5c9xobz.cloudfront.net/`. All paths below are under
`dione.rhea_cassini_vims_ir-mosaic_scipioni_2022/`.

| Product | Relative archive path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Dione cube | `data/dione/dione_notnorm_pc_modified_2.img` | 66,355,200 | `57eb3fcc82c5e2ac3e239008cde901c1ade5641d540088514a880c755de275e6` |
| Rhea cube | `data/rhea/rhea_notnorm_pc_modified_2.img` | 66,355,200 | `b36eb4c5d7c43c76c623fe2e1a5d8a133fd5836ba9f4c4c0442daf478553b9f6` |
| Wavelength table | `data/vims_wavelengths_ir.tab` | 2,304 | `8cb35dca77944143d27db18860ddee6b5ee29369b0fd0e1441b246c90a89a449` |
| Preparation guide | `document/information_file.pdf` | 201,977 | `c6a7599777535917c6ab6d5fc38beab6e811e1045df5e651eba67f5a21da527e` |

Each cube has a companion `.xml` PDS4 label and `.hdr` ENVI header. These, the
wavelength label, the source observation lists and phase-function coefficients
are retained with their original bytes. The cube is 256 bands × 180 lines ×
360 samples: band sequential, little-endian IEEE float32, no header offset.
The declared missing constant is exactly **−999.0**. The labels call the units
reflectance; the guide identifies calibration to dimensionless I/F.

The guide describes RC19 radiometric calibration, manual spectral noise
exclusions, an Akimov disk function and a wavelength-dependent quadratic phase
function. Photometry was normalized to incidence 30° and emergence 0°. `notnorm`
means the spectra were not additionally normalized; `pc` means photometric
correction was applied. The B7 converter does not repeat those corrections.

The guide's input-selection interval is 2004–2015 with phase angles 10°–50°;
the collection metadata extends to 2017. The maps are mosaics of multiple
observations, not one simultaneous observation. Source preparation used
ellipsoidal viewing geometry and proprietary/manual steps, so the original
mission-to-mosaic calculation is not reproduced by this repository. Conversion
of the pinned archived mosaics into these views is reproducible.

## Geographic interpretation and its limit

**Use the guide's global one-degree angular bins:** source columns have
east-positive longitude centers 0.5°…359.5°, source rows have latitude
centers 89.5°N…89.5°S. This is an explicit interpretation of the declared global
grid, not a claimed geodetic correction. Absolute registration at fractions
of one source pixel remains unresolved.

The guide says 360°W→0°W; that is increasing east longitude left to right.
PDS labels say positive east and planetocentric latitude. The three-page guide
contains no figures that resolve the center-versus-corner ambiguity.

The projected metadata cannot simultaneously reproduce the guide's one-degree
global extent. Using the XML's upper-left values as corners gives:

| Body | Declared radius, m | Declared pixel size, m | Implied degrees/pixel | Literal west/east corners, °E | Literal north/south corners |
| --- | ---: | ---: | ---: | --- | --- |
| Dione | 561,400 | 9,773.8 | 0.9975017631 | 0.92926 / 360.02990 | 89.27681 / −90.27351 |
| Rhea | 764,000 | 13,334.3 | 0.9999988387 | 0.48650 / 360.48608 | 89.50000 / −90.49979 |

Dione's pixel spacing instead corresponds nearly to a 560,000 m sphere. ENVI's
upper-left x differs from XML by 180 m; its WKT includes a 180 m false easting,
which explains that offset but does not resolve the angular-grid discrepancy.
No unrecorded change to a source label or inferred higher-precision registration
is made. Each conversion receipt retains the literal metadata calculation and
the explicit `absoluteSubpixelRegistration: unresolved` decision.

Orientation was independently compared with the original, already-pinned ISS
maps [PIA18434](https://www.jpl.nasa.gov/images/pia18434-color-maps-of-dione-2014/)
and [PIA18438](https://www.jpl.nasa.gov/images/pia18438-color-maps-of-rhea-2014/).
JPL credits their geographic registration and photometric correction to Paul
Schenk. These independent visible/near-infrared mosaics are comparison evidence,
not VIMS gap fills. Source-byte pins match the pre-existing body manifests.

| Orientation candidate | Dione correlation | Rhea correlation |
| --- | ---: | ---: |
| Declared row/column orientation | 0.8516 | 0.5099 |
| North/south flip | 0.7674 | 0.4894 |
| East/west mirror | −0.6088 | −0.3481 |
| Longitude rotated 180° | −0.5598 | −0.2177 |

These Pearson correlations compare native VIMS 1.06495 µm with the reduced ISS
red channel within ±60° latitude, using only declared valid VIMS samples. They
support global orientation; they are not a radiometric equality or an absolute
registration measurement. Named-feature placement also supports north-to-south
rows: [Creusa](https://planetarynames.wr.usgs.gov/Feature/1331) is at 49.19°N,
76.32°W=283.68°E, and [Inktomi](https://planetarynames.wr.usgs.gov/Feature/14671)
is at 14.10°S, 112.10°W=247.90°E. Both lie in the appropriate bright regions of
the independent ISS map and the native VIMS plane. The gazetteer uses west
longitude; the west values must not be read as east longitude.

Keep a concise visible qualification with the views: **“One-degree source bins;
registration within a source pixel is uncertain.”** Fine-scale alignment to
crater rims or a precise local boundary is not supported.

## Spectral display and scalar formula

The ENVI headers recommend RGB bands 69, 43, 12 (one-based). Their exact
wavelengths and the fixed, shared display ranges are:

| Channel | Native band | Wavelength, µm | Display I/F range |
| --- | ---: | ---: | --- |
| Red | 69 | 2.00141 | 0…0.30 |
| Green | 43 | 1.57321 | 0…0.45 |
| Blue | 12 | 1.06495 | 0…0.65 |

These are authored display ranges, not calibration coefficients. They are the
same for both bodies, and clip no complete, valid RGB pixel in either pinned
cube. An all-channel-valid mask is resolved before encoding. Each observed
channel is encoded as `floor(1 + 254*clamp(value/rangeHigh,0,1) + 0.5)`;
code 0 belongs exclusively to missing data.

The water-ice view is the fixed-wavelength 2.01788 µm band depth, with a linear
continuum between 1.82022 µm and 2.19970 µm:

```text
t = (2.01788 − 1.82022) / (2.19970 − 1.82022)
  = 0.5208706651206912
continuum = (1 − t) * R58 + t * R81
depth = 1 − R70 / continuum
```

This uses the standard continuum-relative definition, verified in
[Clark et al. 2024, equation 15](https://doi.org/10.3847/PSJ/ad6c3a). It is an
authored fixed-channel indicator rather than a fit to the band minimum or a
reproduction of another paper's map. The continuum regions are supported by
[Rhea VIMS spectral analysis](https://academic.oup.com/mnrasl/article/499/1/L62/5905424).
Absorption strength also varies with grain size, mixtures and remaining
photometric effects; depth is not ice abundance.

All three contributing values must be finite and nonmissing, and the computed
continuum must be positive. No interpolated neighbor replaces an invalid
spectrum. The float32 output preserves derived values; its missing code is −9999.
Display range 0.30…0.75 covers all valid depths in both selected products.

| Body | Valid RGB cells / 64,800 | Valid depth cells / 64,800 | Depth minimum / median / maximum |
| --- | ---: | ---: | --- |
| Dione | 51,884 | 63,780 | 0.3410 / 0.5689 / 0.6987 |
| Rhea | 39,073 | 62,072 | 0.5392 / 0.6424 / 0.7452 |

These counts describe rectangular source cells, not area-weighted planetary
coverage. The 1.06495 µm channel has substantially less valid coverage than the
depth channels. Finite native zero is not declared missing: 10 Dione and 483
Rhea all-zero RGB cells remain observed black after encoding to code 1. They
become missing for depth because division by a zero continuum is undefined.
No value-only dark-pixel heuristic is added.

## Preparation and independent checks

Run `python tools/objects/acquisition/cassini-vims.py RECIPE.json` with the
NumPy/Rasterio environment documented by the existing mapped-science acquisition
requirements. The recipe is schema `cssearth-cassini-vims@1`. It pins the IMG,
XML, HDR, wavelength table and guide, and must explicitly select the guide-grid
interpretation and unresolved subpixel registration. Output grid 360×180 keeps
one output value per native cell, rotating only the longitude address into the
canonical −180°…180° map. Subsequent preparation must use nearest native cells.

Only the six selected BSQ planes are read, one plane at a time. The canonical
GeoTIFFs use a spherical EQC coordinate system with the label's reference radius
and linear angular rows. The output's physical pixel length simply encodes
the chosen one-degree angular bins; it is not a new measurement of resolution.

Eight focused Python tests cover BSQ offsets/endianness and truncation,
partial-spectrum masking, observed zero, continuum arithmetic, invalid
denominators, preservation of negative depth, pole rows, the longitude seam,
missing-neighbor behavior and rejection of implicit grid interpretation.
Independent checks read original values by byte offset and compare native
anchors to the encoded TIFFs: 69 Dione and 71 Rhea probes pass, including real
missing cells, real zeros and the canonical seam. Those numerical checks prove
data transfer under the stated interpretation; they do not settle absolute
subpixel registration.

The working receipts, source downloads, distributions, comparison plot and
independent proof scripts are preserved in the [source review bundle](evidence/source/SOURCE-REVIEW.md). These source checks alone do not establish browser readiness.

## Other source candidates

The same archive has a weighted Rhea cube, but no corresponding weighted Dione
product. Its guide alternately describes resolution weighting and frequency
weighting. The regular-average products provide a consistent, clearly named
pair for this batch. The archived weighted product is not silently mixed in.

[Filacchione et al. 2022](https://arxiv.org/html/2111.15541v1) describe a separate
photometric pipeline, 0.5° maps and digital supplementary data. Publisher access
returned 403 during this source survey, so exact downloadable map bytes remain
unqualified. It is a complementary candidate, not an assumed correction to the
selected Scipioni products. Its arXiv band-depth paragraph prints a ratio
inconsistent with its variable definitions; the B7 formula follows the standard
band/continuum convention above.
