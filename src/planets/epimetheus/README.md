# Epimetheus

## Sources

- **Monochrome:** 5 Cassini ISS narrow-angle, clear-filter frames calibrated to I/F by CISSCAL and distributed by the PDS Ring-Moon Systems Node.

- **Elevation:** radial height of the released shape above a 58.2 km reference sphere, with a shared shaded-relief palette.

- **Geometry:** Thomas, Joseph and Ansty (2018), Saturn Small Moon Shape Models, [PDS release](https://sbn.psi.edu/pds/resource/saturnsatshapes.html), [DOI 10.26033/ewy3-jy61](https://doi.org/10.26033/ewy3-jy61).

## Evidence

- The exact frames, archive URLs and byte pins are in [source/manifest.json](source/manifest.json). [source/preparation/terrestrial.json](source/preparation/terrestrial.json) retains each measured camera solution from the shape release's [source/shape/epimetheus_document.pdf](source/shape/epimetheus_document.pdf).

- Dimensions, floating-point encoding and record lengths are checked before reading.

## Known problems

- **Elevation:** This is a shape-derived scientific visualization, not local altitude above a geoid or a high-resolution crater DEM.

- Model uncertainty: see the per-region confidence discussion in the archived model document.

- Gray grid marks missing coverage. Regions have different source resolution and some visible seams remain; this is a visualization mosaic, not a new calibrated global albedo product.

- **Rotation:** Its secular IAU/PCK rotation terms provide an explicitly approximate fixed-epoch display orientation; periodic libration terms and the precise Cassini binary rotation kernel are omitted.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="epimetheus-source-and-interpretation"></a>

## Selected presentation

- The large-scale irregular figure is included.

- The original plate topology is simplified before texture baking; the configured target is 720 native PolyCSS raster triangles, below the 2,000-leaf ceiling. The source coordinate system is kilometres, +X approximately Saturn-facing, +Y opposite orbital motion, +Z north. Its tables use zero-based plate indices.

## Preparation

The generic source-shape camera preparer maps calibrated photographs using the measured perspective, source shape, west-positive subspacecraft/subsolar coordinates, image north azimuth and origin pixel. The NAC pixel scale uses 12 µm / 2003.44 mm from the [Cassini instrument kernel](https://naif.jpl.nasa.gov/pub/naif/CASSINI/kernels/ik/cas_iss_v10.ti). No camera alignment is fitted by eye.

The attached VICAR header owns the calibrated raster offset. These products retain a binary telemetry record after the label, so the pixels begin at byte 8192; some detached PDS labels have a stale record-2 image pointer.

A bounded Lunar-Lambert disk correction reduces photographed illumination. Incidence/emission cutoffs and source-mesh shadow/visibility tests reject unstable or hidden samples. An edge-connected 0.003 I/F background threshold withholds sky without deleting isolated dark crater interiors. Robust overlap level matching reduces exposure changes. The display maps I/F 0–0.6 linearly to the available brightness range after correction; original calibrated source values remain unchanged. Photographic crater shadows that lack recoverable signal are not invented.

Flood mode retains the corrected observations under uniform illumination. The shared Shadows toggle selects a prepared normal-based directional bank on the same irregular mesh. A spherical lighting overlay is not fitted to this shape. Small dedicated minimaps and navigation images are prepared from the same interpreted surface; HD atlases are never used as minimap downloads.

## Orientation and navigation

The initial camera and navigation portrait look toward 123°E, 4°N, close to the best fully illuminated source viewpoint. This is presentation framing, separate from the source camera geometry.

The astronomy package already owns the moon's Saturn-relative orbital elements. The photograph projection independently uses the archived measured camera solution and does not depend on that display attitude. See `source/preparation/rotation.json` and the pinned NAIF `pck00011.tpc`.

## Dataset survey

- **Included:** [PDS Cassini calibrated imagery](https://pds-rings.seti.org/cassini/iss/calibration.html) and the camera geometry in the [2018 shape release](https://sbnarchive.psi.edu/pds4/cassini/saturn_satellite_shape_models_V1_0/). Complementary viewpoints provide observed coverage without fabricating the far side.

- **Excluded photograph:** Cassini `n1866366469_1` is dominated by cast shadow and contributes less than 0.04% unique valid map coverage in the 512 × 256 source comparison. Its unstable isolated samples are omitted; the remaining five views retain the useful observed terrain.

- **Excluded as the main map:** legacy Voyager/Stooke photomosaics and shaded-relief drawings in the [Stooke map archive](https://sbnarchive.psi.edu/pds3/multi_mission/MULTI_SA_MULTI_6_STOOKEMAPS_V3_0/document/00_map_guide.html). The selected Cassini frames offer finer source detail with explicit registration to this shape. Drawings are not observational textures.

- **Not added as duplicate lenses:** individual clear-filter photographs of the same terrain. They contribute to one Monochrome map.

- **Unresolved for a separate lens:** UV/visible/IR filtered observations exist, but no registered, qualified global color/composition map was located in this pass. The selected package does not claim that only two datasets exist.

- **Facts:** [NASA Epimetheus](https://science.nasa.gov/saturn/moons/epimetheus/) and [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/). No substantial atmosphere or cutaway is claimed.

## Preparation ownership

Source photos and scientific models are preparation inputs, not cold scene downloads. Credits and limitations remain with each dataset.

The initial camera uses the prepared ecliptic presentation basis and the radial mesh’s CSS X/Y transport to face the source portrait direction; geographic longitude/latitude are not copied into scene yaw/pitch.

</details>
