# Pan sources and presentation

## Selected data

The surface uses the [Thomas, Joseph and Ansty Saturn small-moon shape release](https://doi.org/10.26033/ewy3-jy61), archived by the NASA PDS Small Bodies Node. The original `pan_30k_plt.tab` contains 13,736 vertices and 27,468 triangular plates in kilometers. Its companion XML and per-body PDF are retained. The source frame has +X toward Saturn, +Y opposite orbital motion and +Z along the positive rotation axis. The source describes likely radial uncertainties of 0.2–0.3 km, with portions of the leading side least certain; small crater morphology is not reliably resolved by the model.

Geometry is simplified from the source connectivity with the shared meshoptimizer preparer before texture baking. The prepared mesh has 800 native PolyCSS triangle leaves, within the 2,000-leaf ceiling, with a 200 m simplifier error setting. That setting is an algorithmic allowance, not a bound on source scientific uncertainty. No ellipsoid is substituted for the equatorial ridge. A 2,592-direction radial sample (5° grid offset from poles and seam) compared the prepared mesh with the source: mean error 62 m, 95th percentile 136 m, maximum sampled error 249 m. These samples are not an exhaustive maximum error bound.

## Lenses

**Monochrome** uses five original Cassini ISS NAC calibrated I/F frames from March 7, 2017. They are restored from the [PDS Ring-Moon Systems Node](https://pds-rings.seti.org/cassini/iss/access.html) and retain the CISSCAL 4.0beta labels. Inputs: `N1867604669`, `N1867604117`, `N1867602962`, `N1867606181`, `N1867606742`.

Each image is projected onto the released shape using its own sub-spacecraft and subsolar coordinates, distance, projected north angle and measured image center from Table 1 of `pan_document.pdf`. Those tables use west-positive longitude; preparation converts to the mesh's east-positive coordinates. The pinned NAIF `cas_iss_v10.ti` gives a 2003.44 mm focal length and 12 micrometer pixels. The approximation uses the ideal perspective camera and neglects higher-order optical distortion.

The calibrated VICAR header controls binary raster addressing. The archived detached labels retain a stale image pointer and do not account for the binary header record; reading that pointer alone would shift the image by one row. The original files remain unchanged.

The shared preparation applies a bounded Lunar-Lambert display normalization using source geometry, then limited inter-frame brightness matching. This reduces broad acquisition shading; it does not reconstruct cast-shadow interiors or become a calibrated albedo map. Samples beyond the accepted incidence/emission angles, bounded gain or available image footprint are withheld. The frame-edge-connected sky mask uses I/F ≤ 0.003, retaining disconnected dark crater floors; this boundary heuristic may withhold very dark limb pixels. Unobserved regions receive the shared neutral grid. Overlapping views use the better-supported samples; lower-resolution frames remain lower-resolution.

**Elevation** colors radial distance minus a 14 km reference sphere, with a ±7 km scale and fixed relief lighting derived from that same shape. This includes the overall flattened body and equatorial ridge. It is not elevation above a measured geoid, nor a separate fine-resolution stereo DEM. No missing photographic coverage is filled with synthetic imagery.

Both lenses retain the generic Shadows control. The native triangle atlases contain source texture and prepared directional illumination tied to the body frame. No detached spherical lighting shell is used. Minimap and thumbnail images are prepared separately from the same interpreted data; the context image uses the actual shape silhouette and full-phase relief shading.

## Dataset survey

- **Included:** original PDS ISS calibrated frames plus the model release's registered viewing geometry. The 2017 closest-flyby images provide the strongest available detail in the qualified footprint.
- **Included:** PDS plate model, supplying both real geometry and the complementary radial-height view.
- **Excluded as duplicate imagery:** NASA press portraits ([Pan overview](https://science.nasa.gov/saturn/moons/pan/)) reuse the Cassini observations; directly calibrated frames preserve their original coordinates and numerical pixels.
- **Deferred:** filtered Cassini UV/green/infrared frames are present in the PDS archive, including the 2017 encounter. They require independently registered multiband coverage and color qualification, and are not mislabeled as a ready global color map. The current pass delivers the qualified monochrome mosaic and shape-height view.
- **Not selected:** the USGS/DLR standard Cassini global-mosaic series does not supply a downloadable registered Pan map in the inspected release. Papers on these small moons provide regional geological and compositional interpretation; no corresponding global scalar raster was identified for this package. This is a bounded survey, not a claim that no further data exists.

## Orientation, content and credits

The package's approximate fixed-epoch display rotation comes from the pinned [NAIF pck00011 coefficients](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc), with the pole evaluated at the shared 2026 epoch. It is not the `pan_mst2018.bpc` libration solution used to control the shape. Image registration uses the source PDF's independent measured geometry, not the approximate display phase.

Facts are sourced from [NASA's Pan overview](https://science.nasa.gov/saturn/moons/pan/) and the vendored astronomy package. The source mesh, image calibration, scientific-model uncertainty and display simplification are separate properties. Credits: Peter Thomas, Joe Joseph, Trey Ansty; NASA/JPL-Caltech/Space Science Institute; NASA PDS Small Bodies and Ring-Moon Systems Nodes. Starfield: ESO/S. Brunier, CC BY 4.0. Title: Inter by Rasmus Andersson, SIL Open Font License 1.1.

The initial camera uses the prepared ecliptic presentation basis and the radial mesh’s CSS X/Y transport to face the source portrait direction; geographic longitude/latitude are not copied into scene yaw/pitch.
