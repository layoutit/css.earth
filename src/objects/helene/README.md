# Helene

## Sources

- **Monochrome:** 11 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying this moon’s PDS shape. Clear-filter images calibrated to I/F by CISSCAL.

- **False color:** two Cassini ISS NAC IR3/IR1/UV3 triplets from the June 18, 2011 encounter. Infrared and ultraviolet are encoded as RGB after projection onto the same published shape. This is a scientific false-color display, not natural color or measured albedo.

- **Elevation:** radial height above an 18 km reference sphere from the same measured shape.

- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61).

## Evidence

- The exact observations, source URLs and restoration pins are in [source/manifest.json](source/manifest.json) and [source/preparation/acquisition.json](source/preparation/acquisition.json). The simplified surface remains closed and outward wound.

- [Source/package qualification](evidence/close-encounters/qualification.json) verifies every delivered asset and source input and preserves the geometry recipe and retained scene geometry from main (ebd16155a). The fixed 2,048 × 1,024 preparation grid accepts 1,066,236 → 1,067,659 Monochrome cells and 241,046 False color cells. These are preparation-grid counts, not physical surface-area percentages.

- [Delivery](evidence/close-encounters/delivery.json) verifies the changed immutable HTTPS assets by length and SHA-256. [Elevation reproduction](evidence/close-encounters/elevation-reproduction.json) confirms that the current unchanged main preparer reproduces the existing elevation dataset; the refreshed shadow bank is unrelated to the added photographs.

- [Browser capture](evidence/close-encounters/capture.json): Chrome 152, DPR 1/2, Shadows off/on, drag with retained DOM, and a 390-pixel mobile selector passed. Inspect the [False color product view](evidence/close-encounters/product.png), [rotated lighting](evidence/close-encounters/oblique-shadows-dpr1.png), [mobile view](evidence/close-encounters/mobile.png) and [Monochrome close-up](evidence/close-encounters/monochrome.png). The captured source, recipe and runtime hashes identify the uncommitted moon changes over ebd16155a; the later main merge 3b40e0723 changes Ryugu and its scientific-raster preparation, leaving these moon inputs and the shared browser code unchanged. The [Monochrome capture](evidence/close-encounters/monochrome.json) also mounts successfully after that merge.

## Known problems

- **Elevation:** Includes the broad irregular figure; it is not local altitude above a geoid. Published regional radius uncertainty is 0.15–0.3 km. Small crater morphology is not reliably represented.

- **Monochrome:** Illumination correction does not recover unobserved or truly shadowed terrain. Missing samples remain gray grid. Resolution varies with the source views; this is a visualization mosaic, not a new scientific global albedo measurement.

- **False color:** only complete three-filter footprints contribute. Different filter times and illumination remain relevant; colors alone do not identify composition. The relative feature checks do not improve the published 150–300 m shape uncertainty or establish independent absolute geolocation.

- The IAU secular rotation in [source/preparation/rotation.json](source/preparation/rotation.json) is an approximate display orientation. It is not the binary Cassini libration model used to control the source shape; the archived camera records independently own photograph registration.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="helene-source-and-interpretation"></a>

## Selected datasets

- The shared shaded-relief palette shows model slopes, not invented small craters.

- Original plate table and camera document are retained under `source/shape`. Kilometres, zero-based plate indices, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north.

## Preparation and display

The shared controlled-shape camera preparer uses source perspective, west-positive sub-spacecraft and sub-solar coordinates, north azimuth and image-center pixels. Clear-filter camera registration is taken from the release. For the second color sequence, detector translation and roll are fitted to source-image features on that fixed shape, with separate held-out patches; range, pointing direction and focal scale remain those of the release. The NAC pixel angle is 12 µm / 2003.44 mm from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). The attached VICAR label owns pixel offset and record size; these calibrated products retain a telemetry record before the raster.

Preparation applies bounded Lunar-Lambert illumination correction (maximum gain 2.5), source-mesh visibility and cast-shadow rejection, and overlap exposure matching (0.7–1.4). Edge-connected sky below 0.003 I/F is excluded before interpolation; isolated dark features are retained. Monochrome corrected values are displayed linearly over 0–1.05 I/F. Color retains floating-point I/F through projection and complete-triplet blending, uses one common 0–1.05 range, then applies the shared IEC sRGB display transfer once. This is a display range, not a calibration of natural color; there is no independent channel stretch or white balance. Source files remain unchanged.

The original connected shape is simplified before atlas baking to 800 native PolyCSS `u` leaves (maximum estimated simplifier error 300 m), under the 2,000-leaf budget. Textures use 2,048 × 1,024 intermediate maps and prepared triangle atlases; WebP quality 94 is a delivery choice, not added source resolution. Flood and directional lighting use the same shared mesh-normal preparation and Shadows control. No detached spherical overlay, atmosphere, ring mesh or private controller is added.

Navigation portraits and small dedicated minimaps are derived from the prepared surface. Initial view looks toward 177.68°E, -3.98°N, transformed through the ecliptic presentation basis and CSS X/Y transport.

## Dataset survey

- **Included:** [PDS calibrated Cassini ISS](https://pds-rings.seti.org/cassini/iss/calibration.html), the [2018 shape release and controlled camera table](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/helene_document.pdf), and shape-derived radial elevation.

- **Not separate lenses:** individual clear-filter frames and alternate contrast versions of the same observations. They contribute complementary resolution or coverage to Monochrome.

- **Investigated, not included as an observed map:** legacy Voyager/Stooke maps and global shaded-relief illustrations. They do not offer the combination of Cassini detail and measured camera registration used here; drawings are not observational textures.

- **Filtered imaging:** IR3 N1687120587_1, IR1 N1687120557_1 and UV3 N1687120624_1 retain the released cameras and are checked against GRN N1687120497_1. The neighboring IR3 N1687119936_1, IR1 N1687119906_1 and UV3 N1687119973_1 sequence is aligned to RED N1687120033_1, which is itself aligned to that green reference. Native labels identify full-resolution, lossless CISSCAL I/F products.

- **Registration:** portable [reference](source/preparation/close-encounters-reference.json) and [filter](source/preparation/close-encounters-filters.json) jobs retain the input cameras; their original [reference fit](source/validation/close-encounters-reference.json) and [filter fits](source/validation/close-encounters-filters.json) retain all accepted controls and residuals. The preparer rechecks the final cameras without refitting. All seven checks pass the existing held-out RMS ≤1 pixel and maximum ≤2 pixels criteria: RMS 0.27–0.86 pixels, maximum 1.51 pixels. The reference fit includes an 8.4-pixel training outlier; its independently held-out residuals pass, and the report keeps that outlier visible.

- **Clear-filter detail:** N1687119135_1 adds a roughly 44 m/pixel close view; N1687121164_1, N1687121224_1 and N1687121524_1 add neighboring views. The former closest selected view was roughly 58 m/pixel. These are nominal source pixel footprints at the model center, not uniform delivered resolution. Accepted map coverage grows only slightly; most of the benefit is additional detail and overlapping observations.

- **Spectroscopy:** [Cassini spectra and photometry of small inner satellites](https://www.usgs.gov/publications/cassini-spectra-and-photometry-025-51-mm-small-inner-satellites-saturn) and [small-moon photometric analyses](https://doi.org/10.3847/1538-3881/ab659d) inform interpretation. Disk-integrated measurements do not supply a spatially resolved composition texture.

- **Facts and imagery reference:** [NASA Helene](https://science.nasa.gov/saturn/moons/helene/), [JPL satellite parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) and the PDS shape document. No atmosphere or internal cross section is claimed.

## Orbit and orientation limits

The shared astronomy package owns Saturn-relative position, scale and orbit. Its compact precessing ellipse is compared against six independent JPL vector samples; the reported differences are measured fit residuals, not bounded accuracy. Source URLs and intervals travel with the generated orbit and fixtures.

## Source restoration

The shared acquisition plan restores the pinned scientific inputs for preparation. Runtime users do not download the source plate models, floating-point camera frames or starfield TIFF. See NOTICE.md for credits.

</details>
