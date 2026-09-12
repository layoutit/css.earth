# Oberon

## Sources

Oberon's Monochrome view uses Paul Schenk's September 2020 [Uranian Satellites — Global Mosaics and DEMs](https://repository.hou.usra.edu/handle/20.500.11753/1687), based on Voyager 2 images registered with updated control networks. The original selected product is [`oumap-cyl-180180.cub`](https://repository.hou.usra.edu/bitstreams/33526bf8-69e4-4246-b995-0b238a8b31d0/download). The release's [author README](https://repository.hou.usra.edu/bitstreams/00528589-53e3-496b-ac5d-b6d86fe527c9/download) is retained in [the retained author notes](source/observations/aaReadMe_uranian_MAP_DEM.txt).

Source photometric correction does not remove local cast shadows or guarantee seamless exposures. The Monochrome view is a display of the published corrected observations, not a newly calibrated albedo measurement.

## Evidence

Lane change (this PR): the terrestrial solid-observation lane was retired for Oberon; the same pinned inputs and the same decoders (`terrestrial-observation` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — native ISIS cube 957 × 479; the retired 5760 × 2880 atlas was an upsample. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; the nomenclature recipe and map edge are unchanged and the labels were re-drawn against the new atlas. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js oberon --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/oberon/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (normal) with no console errors or failed requests, and pinned a Gazetteer feature from the sidebar search on the standard mesh (feature id 2340).

Gazetteer rims drawn over the prepared equirectangular minimap at both candidate map edges (`output/edge-markers.mjs`) agree with the declared `mapLeftEdgeLongitudeDeg` in `source/preparation/features.json`.

Independent untile-and-geographic checks use [USGS Gazetteer](https://planetarynames.wr.usgs.gov/SearchResults?Target=97_Oberon) centers for Hamlet (44.4° E, 46.1° S), Macbeth (112.5° E, 58.4° S), Othello (42.9° E, 66° S), and Coriolanus (345.2° E, 11.4° S). These check numerical registration, not subpixel agreement with the Gazetteer's older feature outlines.

**Excluded color trial, 7 September 2026.** A perspective reconstruction matched the clear frame to this package's mapped
source, then registered the other bands to the clear image. Final image-space
RMS residuals were 0.55 pixels (clear), 0.86 (violet) and 1.07 (green). A bounded
Lunar-Lambert trial used current Horizons/NAIF capture geometry, preserved
measured channel ratios, and withheld unstable limb/terminator samples. Green,
clear and violet were displayed as RGB, with monochrome outside color coverage;
no monochrome detail was injected into the color bands.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Oberon (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Hamlet and Mommur Chasma on the prepared minimap (±180° cylindrical cube) coincide with the imagery.

ISIS special pixels remain missing before interpolation; incomplete interpolation footprints are withheld. Valid dark terrain remains observed terrain. The gray grid identifies real gaps, including unobserved northern regions. The package does not fill the northern hemisphere by mirroring or extrapolating observations. Surface, poles, thumbnails and minimap share the same interpretation. The navigation/context marker is a crop of observed terrain with shared full-phase curvature; it illustrates the mapped texture rather than claiming an observed full disc.

**Not included:** matched Chrome globe views remained noticeably softer than the
published monochrome mosaic, with chromatic fringes and a visible coverage
transition. The trial establishes an accessible color source and feasible coarse
registration, but does not qualify a second lens for this package. Further work
would need better inter-band registration and a sharper, validated reconstruction;
the existing observed-color candidate is no longer merely a missing-download issue.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="surface-and-coverage"></a>
<a id="dataset-survey"></a>
<a id="final-color-reconstruction-trial-2026-09-07"></a>
<a id="physical-context-and-restoration"></a>

<details>
<summary>Methods and source notes</summary>

**Surface and coverage**

The cube contains 957 × 479 Real/Lsb samples in 319 × 479 tiles, with 5,000 m pixels. Its mapping is simple cylindrical, planetocentric and positive-east, with projection center 180°, longitude bounds −180…180°, upper-left projected origin (−4,785,000 m, 1,200,000 m), and equal equatorial/polar mapping radii of 761,400 m. The `CLEAR` band label gives a 0.46 μm center and 0.36 μm width. Native sampling is approximately 2.658 pixels per degree; effective detail varies across contributing observations.

The package preserves the original floating-point ISIS3 mosaic byte-for-byte inside gzip. Preparation reads its actual mapping labels and special pixels, registers it into the application's east-positive 0–360° surface map, and applies a single recorded linear display stretch.

The cube history records `photomet` on 2020-02-18 with ellipsoid angles, maximum emission 81° and maximum incidence 89.7°, followed by high/low-pass mosaic combination and map reprojection. The named photometric PVL is not included as an independently interpreted calibration input. No additional photometric model is invented here. Display DN 0–2100 maps linearly to 0–255, encompassing the original valid range of approximately 54.09–2084.88.

The shared 452-face sphere uses the vendored mean radius of 761.4 km, within the 2,000-face budget. It does not encode measured relief. The authored camera faces southern terrain at 45° E, 60° S through the common ecliptic presentation frame. Geometry, map packing, lighting atlases and companion images are prepared ahead of runtime. The canonical prepared asset bank is fixed per mount independently of DPR. Shared flood curvature and optional directional Shadows remain available. No atmospheric layer is supplied.

The 5760 × 2880 prepared sampling grid, 64-pixel atlas gutters and 1024-pixel pole tiles provide adequate projective sampling on the retained sphere. This denser atlas prevents rendering artifacts; it adds no native observations or resolved detail. Final surface WebP uses quality 95. A 180 × 180 crop beginning at (35, 265) in the 957 × 479 normalized map feeds the 256-pixel context marker; its complete source footprint is observed.

**Dataset survey**

| Candidate | Decision and limits |
| --- | --- |
| Schenk/LPI 2020 `oumap-cyl-180180.cub` | Included as Monochrome. Updated control network and native numeric samples make it preferable to the older display-texture map. The release supplies photometrically corrected imagery; preserved shadows and seams are disclosed. |
| Schenk/LPI 2020 [`oumap_Zlimb.cub`](https://repository.hou.usra.edu/bitstreams/c256d12e-7dd9-4e1a-a190-7c2f05932d06/download) | Excluded as an Elevation lens. These are sparse digitized limb profiles, not extended surface elevation coverage. The author warns that their older control network may displace them by several degrees. They must not be expanded into neighboring terrain or treated as a registered full-surface DEM. |
| [Schenk and Moore 2023 topography overview](https://www.hou.usra.edu/meetings/uranusflagship2023/pdf/8140.pdf) and [2020 source paper](https://doi.org/10.1098/rsta.2020.0102) | Supporting scientific context. The authors explicitly describe the lack of extended topography on Oberon and Umbriel, confirming why this package has no Elevation lens. Paper figures are not substitutes for measured raster coverage. |
| [JPL simulator Oberon texture](https://space.jpl.nasa.gov/tmaps/uranus.html), 1440 × 720, 4 pixels/degree | Superseded as a display source. It derives from USGS/Voyager grayscale imagery, but does not provide the selected release's revised control metadata and floating-point source values. Its nominal pixel count is not evidence of more native detail. No duplicate lens is added. |
| [PDS Voyager 2 Uranus ISS EDR archive](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=VG2-U-ISS-2-EDR-V1.0) | Underlying observation archive, excluded from this presentation in favor of the already corrected and controlled release. Raw frames would require a separate radiometric and pointing reconstruction; PDS warns about errors in original emission/incidence metadata. |
| [Helfenstein et al. 1991 color photometry](https://ntrs.nasa.gov/citations/19910046112) | Distinct color/albedo candidate. The cited calibrated Voyager sequence was reconstructed in the final trial below; its mounted visual quality did not qualify a second lens for this package. |
| [JPL PIA00034 color disc](https://www.jpl.nasa.gov/images/pia00034-oberon-at-voyager-closest-approach/) | Excluded from mapped lenses. The published disc reconstructs color from violet, clear and green filters; the press image alone does not supply a calibrated, registered surface product or new coverage. |
| [Geologic map manuscript catalog](https://planetarymapping.elte.hu/map-catalog/map/6000/geologic-map-of-oberon/) | Unresolved interpretive candidate. The catalog records a manuscript color plate but supplies no downloadable qualified geospatial units or source projection/coverage metadata. It is not used as a scientific raster. |

**Final color reconstruction trial (2026-09-07)**

Tested the actual PDS calibrated, distortion-corrected frames `C2683625_GEOMED.IMG`
(CLEAR), `C2683627_GEOMED.IMG` (VIOLET) and `C2683629_GEOMED.IMG` (GREEN), from
the [VGISS_7206 C26836XX directory](https://pds-rings.seti.org/holdings/volumes/VGISS_7xxx/VGISS_7206/DATA/C26836XX/).
These are the approximately 5 km/pixel sequence identified by
[Helfenstein et al.](https://www.lpi.usra.edu/meetings/lpsc1990/pdf/1250.pdf).
The PDS labels provide I/F calibration and pixel field of view; the 1000 × 1000
image grid contains a roughly 300-pixel moon disc.

**Physical context and restoration**

Physical and orbital values use the vendored astronomy package: JPL satellite elements and IAU/NAIF rotation at the shared epoch. The package uses a 761.4 km mean radius and about 583,500 km orbital semimajor axis, with synchronous rotation and an approximately 13.46-day orbit. [NASA's overview](https://science.nasa.gov/uranus/moons/oberon/) and the Voyager image caption supply editorial facts. Mapping radii and the release's reference ellipsoid belong to the source map and are distinct from the scene's mean-radius sphere.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 761.4 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 13.4636-day prograde rotation (synchronous: the astronomy package's orbital mean motion) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 23.17° initial pitch, -47.63° yaw, taken from the retired lane's camera). The heliocentric view keeps the orbit around Uranus and the parent marker now comes from the shared navigation atlas.

</details>
