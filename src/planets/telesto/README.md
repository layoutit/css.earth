# Telesto

## Sources

- **Monochrome:** 7 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying this moon’s PDS shape. Clear-filter images calibrated to I/F by CISSCAL.

- **False color:** Cassini ISS NAC IR3, green and UV3 photographs, encoded as red, green and blue after each frame is projected with its released PDS shape-camera record. This is false color, not natural color or a calibrated albedo map.

- **Elevation:** radial height above a 12.35 km reference sphere from the same measured shape.

- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61).

## Evidence

- The exact observations, source URLs and restoration pins are in [source/manifest.json](source/manifest.json) and [source/preparation/acquisition.json](source/preparation/acquisition.json). The simplified surface remains closed and outward wound.

- [Source/package qualification](evidence/close-encounters/qualification.json) verifies every delivered asset and source input and preserves the geometry recipe and retained scene geometry from main (ebd16155a). The fixed 2,048 × 1,024 preparation grid accepts 1,268,390 → 1,275,448 Monochrome cells and 137,013 False color cells. These are preparation-grid counts, not physical surface-area percentages.

- [Delivery](evidence/close-encounters/delivery.json) verifies the changed immutable HTTPS assets by length and SHA-256. [Elevation reproduction](evidence/close-encounters/elevation-reproduction.json) confirms that the current unchanged main preparer reproduces the existing elevation dataset; the refreshed shadow bank is unrelated to the added photographs.

- [Browser capture](evidence/close-encounters/capture.json): Chrome 152, DPR 1/2, Shadows off/on, drag with retained DOM, and a 390-pixel mobile selector passed. Inspect the [False color product view](evidence/close-encounters/product.png), [rotated lighting](evidence/close-encounters/oblique-shadows-dpr1.png), [mobile view](evidence/close-encounters/mobile.png) and [Monochrome close-up](evidence/close-encounters/monochrome.png). These captures identify the uncommitted moon changes over ebd16155a by recipe, runtime and served-image hashes. The later main merge 3b40e0723 leaves these inputs and the shared browser code unchanged; the [Monochrome capture](evidence/close-encounters/monochrome.json) also mounts successfully after that merge.

## Known problems

- **Elevation:** Includes the broad irregular figure; it is not local altitude above a geoid. Published regional radius uncertainty is 0.2–0.35 km. Small crater morphology is not reliably represented.

- **Monochrome:** Illumination correction does not recover unobserved or truly shadowed terrain. Missing samples remain gray grid. Resolution varies with the source views; this is a visualization mosaic, not a new scientific global albedo measurement.

- **False color:** The three source frames have different times and camera positions. The filters span 14 minutes and phase angles of 66–78 degrees. Hue can reflect changing illumination as well as filter response; it does not establish composition. Only their common reliable footprint may carry color; gray grid and cast-shadow exclusions remain. A fixed-camera diagnostic did not yield the six independent feature patches needed to refine or independently validate these small, smooth targets. That result does not remove the released PDS camera-table registration and no camera was fitted or tuned here.

  Green edging is visible near parts of the footprint. The three-band product does not separate illumination differences from residual camera/shape alignment errors at these edges; it must not be interpreted as a compositional boundary.

- The IAU secular rotation in [source/preparation/rotation.json](source/preparation/rotation.json) is an approximate display orientation. It is not the binary Cassini libration model used to control the source shape; the archived camera records independently own photograph registration.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="telesto-source-and-interpretation"></a>

## Selected datasets

- The shared shaded-relief palette shows model slopes, not invented small craters.

- Original plate table and camera document are retained under `source/shape`. Kilometres, zero-based plate indices, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north.

## Preparation and display

The shared controlled-shape camera preparer uses source perspective, west-positive sub-spacecraft and sub-solar coordinates, north azimuth and image-center pixels. Camera registration is taken from the release, not fitted by eye. The NAC pixel angle is 12 µm / 2003.44 mm from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). The attached VICAR label owns pixel offset and record size; these calibrated products retain a telemetry record before the raster.

Preparation applies bounded Lunar-Lambert illumination correction (maximum gain 2.5), source-mesh visibility and cast-shadow rejection, and overlap level matching fitted where both frames see the surface within 70° of incidence and emission (widest gain 3.00). Edge-connected sky below 0.003 I/F is excluded before interpolation; isolated dark features are retained. Monochrome corrected values are displayed linearly over 0–1.2 I/F, the 99.5th percentile of displayed samples. False color keeps floating-point I/F in its band set, colors a point only where all three bands qualify, uses the same range for all channels, then applies one final sRGB display transfer. Source files remain unchanged.

The original connected shape is simplified before atlas baking to 600 native PolyCSS `u` leaves (maximum estimated simplifier error 350 m), under the 2,000-leaf budget. Textures use 2,048 × 1,024 intermediate maps and prepared triangle atlases; WebP quality 94 is a delivery choice, not added source resolution. Flood and directional lighting use the same shared mesh-normal preparation and Shadows control. No detached spherical overlay, atmosphere, ring mesh or private controller is added.

Navigation portraits and small dedicated minimaps are derived from the prepared surface. Initial view looks toward 67.17°E, -3.84°N, transformed through the ecliptic presentation basis and CSS X/Y transport.

## Dataset survey

- **Included:** [PDS calibrated Cassini ISS](https://pds-rings.seti.org/cassini/iss/calibration.html), the [2018 shape release and controlled camera table](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/telesto_document.pdf), and shape-derived radial elevation.

- **Monochrome extension:** Clear frame N1831468631_1 extends the 2016 released-table sweep beyond the former N1831467723_1 endpoint, through the table’s original camera; no shape, topology or renderer change is involved. Its neighbour N1831469816_1 is excluded: it sees Telesto as a 147° phase crescent, every sample lies at 79–80° incidence, its median value is 0.151 against 0.54–0.74 in the other frames, and no overlap reaches it to set a level.

- **Investigated, not included as an observed map:** legacy Voyager/Stooke maps and global shaded-relief illustrations. They do not offer the combination of Cassini detail and measured camera registration used here; drawings are not observational textures.

- **Filtered imaging:** IR3 N1831466962_1, GRN N1831466394_1 and UV3 N1831467236_1 are CISSCAL 4.0beta calibrated, losslessly compressed ISS NAC products. Their native labels state 1024 × 1024, 32-bit PC_REAL pixels in I/F and identify the filters. The [2018 PDS camera table](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/telesto_document.pdf) supplies each frame’s source camera. The display maps IR3/GRN/UV3 to red/green/blue without a white balance, phase correction or natural-color claim. NASA’s [PIA07697 color composite](https://science.nasa.gov/resource/a-closer-look-at-telesto-false-color/) is a perspective illustration and is not used here.

- **Spectroscopy:** [Cassini spectra and photometry of small inner satellites](https://www.usgs.gov/publications/cassini-spectra-and-photometry-025-51-mm-small-inner-satellites-saturn) and [small-moon photometric analyses](https://doi.org/10.3847/1538-3881/ab659d) inform interpretation. Disk-integrated measurements do not supply a spatially resolved composition texture.

- **Facts and imagery reference:** [NASA Telesto](https://science.nasa.gov/saturn/moons/telesto/), [JPL satellite parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) and the PDS shape document. No atmosphere or internal cross section is claimed.

## Orbit and orientation limits

The shared astronomy package owns Saturn-relative position, scale and orbit. Its compact precessing ellipse is compared against six independent JPL vector samples; the reported differences are measured fit residuals, not bounded accuracy. Source URLs and intervals travel with the generated orbit and fixtures.

## Source restoration

The shared acquisition plan restores the pinned scientific inputs for preparation. Runtime users do not download the source plate models, floating-point camera frames or starfield TIFF. See NOTICE.md for credits.

</details>
