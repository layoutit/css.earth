# Helene source and interpretation

## Selected datasets

- **Monochrome:** 7 calibrated Cassini ISS NAC photographs, projected using the measured camera records accompanying this moon’s PDS shape. Clear-filter images calibrated to I/F by CISSCAL.
- **Elevation:** radial height above an 18 km reference sphere from the same measured shape. Includes the broad irregular figure; it is not local altitude above a geoid. The shared shaded-relief palette shows model slopes, not invented small craters.
- **Geometry:** [Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models](https://doi.org/10.26033/ewy3-jy61). Original plate table and camera document are retained under `source/shape`. Kilometres, zero-based plate indices, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north. Published regional radius uncertainty is 0.15–0.3 km. Small crater morphology is not reliably represented.

## Preparation and display

The shared controlled-shape camera preparer uses source perspective, west-positive sub-spacecraft and sub-solar coordinates, north azimuth and image-center pixels. Camera registration is taken from the release, not fitted by eye. The NAC pixel angle is 12 µm / 2003.44 mm from the [instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). The attached VICAR label owns pixel offset and record size; these calibrated products retain a telemetry record before the raster.

Preparation applies bounded Lunar-Lambert illumination correction (maximum gain 2.5), source-mesh visibility and cast-shadow rejection, and overlap exposure matching (0.7–1.4). Edge-connected sky below 0.003 I/F is excluded before interpolation; isolated dark features are retained. Corrected values are displayed linearly over 0–1.05 I/F. Source files remain unchanged. Illumination correction does not recover unobserved or truly shadowed terrain. Missing samples remain gray grid. Resolution varies with the source views; this is a visualization mosaic, not a new scientific global albedo measurement.

The original connected shape is simplified before atlas baking to 800 native PolyCSS `u` leaves (maximum estimated simplifier error 300 m), under the 2,000-leaf budget. The simplified surface remains closed and outward wound. Textures use 2,048 × 1,024 intermediate maps and prepared triangle atlases; WebP quality 94 is a delivery choice, not added source resolution. Flood and directional lighting use the same shared mesh-normal preparation and Shadows control. No detached spherical overlay, atmosphere, ring mesh or private controller is added.

Navigation portraits and small dedicated minimaps are derived from the prepared surface. Initial view looks toward 177.68°E, -3.98°N, transformed through the ecliptic presentation basis and CSS X/Y transport.

## Dataset survey

- **Included:** [PDS calibrated Cassini ISS](https://pds-rings.seti.org/cassini/iss/calibration.html), the [2018 shape release and controlled camera table](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/document/helene_document.pdf), and shape-derived radial elevation. The exact observations, source URLs and restoration pins are in `source/manifest.json` and `source/preparation/acquisition.json`.
- **Not separate lenses:** individual clear-filter frames and alternate contrast versions of the same observations. They contribute complementary resolution or coverage to Monochrome.
- **Investigated, not included as an observed map:** legacy Voyager/Stooke maps and global shaded-relief illustrations. They do not offer the combination of Cassini detail and measured camera registration used here; drawings are not observational textures.
- **Filtered imaging:** the source camera table includes visible/UV/IR observations. A separate registered color product is not qualified in this release; this is not a claim that only two datasets exist.
- **Spectroscopy:** [Cassini spectra and photometry of small inner satellites](https://www.usgs.gov/publications/cassini-spectra-and-photometry-025-51-mm-small-inner-satellites-saturn) and [small-moon photometric analyses](https://doi.org/10.3847/1538-3881/ab659d) inform interpretation. Disk-integrated measurements do not supply a spatially resolved composition texture.
- **Facts and imagery reference:** [NASA Helene](https://science.nasa.gov/saturn/moons/helene/), [JPL satellite parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) and the PDS shape document. No atmosphere or internal cross section is claimed.

## Orbit and orientation limits

The shared astronomy package owns Saturn-relative position, scale and orbit. Its compact precessing ellipse is compared against six independent JPL vector samples; the reported differences are measured fit residuals, not bounded accuracy. Source URLs and intervals travel with the generated orbit and fixtures. The IAU secular rotation in source/preparation/rotation.json is an approximate display orientation. It is not the binary Cassini libration model used to control the source shape; the archived camera records independently own photograph registration.

## Reproduction

`pnpm setup:assets --object=helene` installs only the published runtime files. The shared acquisition plan restores the pinned scientific inputs for preparation. Runtime users do not download the source plate models, floating-point camera frames or starfield TIFF. Prepare through the generic authored-object command. See NOTICE.md for credits.
