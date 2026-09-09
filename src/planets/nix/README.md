# Nix

## Sources

Nix has one **Shape model** view. Geometry comes from [Simon Porter’s released 2021 mesh](https://doi.org/10.6084/m9.figshare.12779948.v1), under CC BY 4.0. The original compressed ASCII STL, release metadata and source description are preserved. Its 40,002 vertices and 80,000 triangles describe the broad elongated body; this parametric fit is not a global measured elevation raster.

The STL declares no units. Matching the paired publication’s 48.4 × 33.8 × 31.4 km dimensions supports an inferred scale of **500 m per source unit**. The resulting 48.414469 × 33.828977 × 31.495628 km extents are retained without deforming the short-axis discrepancy.

## Evidence

The shared STL loader retains the released topology; `source-meshoptimizer` reduces it to 800 native PolyCSS `u` raster triangles with a 500 m simplifier setting. The estimate is 160.029 m. Source and prepared meshes are closed, outward wound, single-component surfaces with Euler characteristic two. Independent source-versus-display radial intersections in 2,000 Fibonacci equal-area directions give 84.859 m mean, 181.121 m 95th percentile and 299.678 m maximum sampled error, with no missing rays. These are display approximation checks, not source measurement uncertainties or an exhaustive maximum-error bound.

Browser interaction, DPR checks and visual acceptance are recorded separately from these source checks.

[Source checks](../../../tests/objects/unit/nix/source.test.mjs) define the package tests; this link is not a new test result.

## Known problems

LORRI constrained the southern hemisphere and equatorial regions; MVIC constrained the northern extent. The release describes joint shape, pole and pointing fits, but provides only an STL: the fitted camera offsets, absolute phase and body attitude are missing. Real, well-resolved images therefore remain **unqualified for projection onto this mesh**, not absent scientific data.

The neutral grid marks missing imagery, not surface color or albedo. The real reddish crater is discussed as observational context and is not invented as a texture. No image-to-mesh illumination correction is inferred while the fitted camera transform is missing.

Model longitude is `atan2(y,x)` and north latitude is `asin(z/r)`. The historical Weaver et al. (2016) encounter pole, RA 350°, Dec 42°, and 1.829 day rotation period are explicitly approximate display inputs. Arbitrary phase is not a 2026 ephemeris or a recovered Porter-mesh prime meridian. Nix is not synchronously aligned toward Pluto.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="nix-sources-and-interpretation"></a>
<a id="dataset-survey"></a>
<a id="preparation-and-restoration"></a>

<details>
<summary>Methods and source notes</summary>

**Dataset survey**

Checked 2026-09-08, including actual archive metadata and research releases beyond press imagery. Labels and OPUS metadata are pinned in `source/survey/`.

| Candidate | Disposition |
| --- | --- |
| [Porter 2021 Figshare mesh](https://doi.org/10.6084/m9.figshare.12779948.v1) | **Included.** Clearly licensed released shape; the API lists one STL gzip and no texture, fitted attitude or image-registration sidecar. Geometry scale is qualified above. |
| [PDS best native LORRI exposure](https://opus.pds-rings.seti.org/holdings/volumes/NHxxLO_xxxx/NHPELO_2001/data/20150714_029917/lor_0299174134_0x636_sci.lbl) | **Unresolved photographic mapping.** `LOR_0299174134_0X636_SCI`, 2015-07-14 10:03:35.806 UTC, 1024 × 1024 float DN, about 0.30023 km/pixel and 9.544° phase. The actual label’s body-fixed subspacecraft and subsolar coordinates are `N/A`. Camera WCS and inertial vectors alone do not establish the final fitted mesh transform. A future projection must qualify pointing/shape residuals, calibrated intensity, per-observation correction and coverage. |
| [PDS high-phase MVIC panchromatic exposure](https://pdssbn.astro.umd.edu/holdings/nh-p-mvic-3-pluto-v3.0/data/20150714_029917/mp2_0299178462_0x53f_sci.lbl) | **Unresolved complementary monochrome coverage.** CLEAR TDI scan, 5024 × 8463, 2015-07-14 11:15:50 UTC, 86.1° phase; the encounter paper reports 0.45 km/native pixel. Strong cast shadows and changing TDI geometry need source-owned correction. The label also omits body-fixed coordinates. It would contribute to one monochrome view, not create an instrument-named duplicate lens. |
| [PDS MVIC color sequence](https://pdssbn.astro.umd.edu/holdings/nh-p-mvic-3-pluto-v3.0/data/20150714_029917/mc0_0299171078_0x536_sci.lbl) | **Unresolved useful color view.** MC0–MC3_0299171078 cover red, blue, near-infrared and methane bands at about 1.99 km/native pixel and 6.1° phase. They measure the real reddish region, but their separate TDI bands need qualified image-to-mesh and cross-band registration. |
| [PDS derived composition collection](https://doi.org/10.26007/mc7j-ef52) | **Included as spectral context; excluded as a mapped lens.** The actual overview is pinned. MVIC bands are coregistered to each other in image space, retain DN units and unmatched PSFs, and may have limb artifacts. Nix’s finest LEISA scan is 3.7 km/pixel, but the small-moon cubes explicitly omit geometry products. No registered mineral map is supplied for Nix. |
| [Porter et al. 2025 talk](https://www.hou.usra.edu/meetings/plutosystem2025/presentations/Friday/1135_Porter.pdf) | **Unresolved improved model and albedo.** Reports a 49.0 × 33.5 × 28.8 km fit and initial albedo mapping. No downloadable updated mesh, albedo raster or fitted camera transformations were found with the presentation. The 2021 model is not relabeled or rescaled as the newer solution. |
| [PDS geophysical release](https://pdssbn.astro.umd.edu/holdings/nh-p_psa-lorri_mvic-5-geophys-v1.0/dataset.shtml) | **Excluded for Nix.** The actual global mosaics, topography and bond-albedo products cover Pluto and Charon. No Nix global product was substituted from those bodies. |
| [Weaver et al. 2016](https://arxiv.org/abs/1604.05366), USGS/LPI and SBMT | Encounter observations and historical spin supply context. SBMT lists Nix/Hydra shapes; the directly accessible Porter mesh was selected. No better publicly downloadable mesh with a complete registered surface package was located. This does not establish that further mission-team data do not exist. |

**Preparation and restoration**

The source manifest pins the original mesh, no-data material, title font, starfield, source documents and generated context portrait. The compact authored material and portrait are checked in. `source/preparation/acquisition.json` restores the external mesh, font and starfield. Use `node tools/objects/dist/operations.js acquire nix --verify-only` for closure and `node tools/objects/dist/prepare-authored.js nix --write` for shared preparation. The runtime publisher installs the actual prepared inventory independently of source acquisition.

**Scale qualification:** STL carries no intrinsic length unit. Raw coordinate bounds span 96.828938 × 67.657953 × 62.991257, while the paired release description gives 48.4 × 33.8 × 31.4 km. cssEarth explicitly applies **500 metres per source unit**, giving 48.414469 × 33.828977 × 31.495628 km. This conversion is inferred from the paired mesh and publication dimensions; it is not a kilometre unit declared inside the file. The small remaining short-axis difference is retained, not deformed away. The source volume after conversion is 25,526.467272 km³, equivalent to a sphere of radius 18.2656039 km. Exact raw bounds, source volume, conversion and formula are in `source/measurements.json`. The original axes are not rotated or recentered.

No surface texels are selected. A constant 64 × 32 RGB material, with every channel 160, is marked entirely unavailable before the shared recipe paints the standard neutral grid. The grid is not Nix’s color, crater distribution or albedo. Surface, thumbnail, minimap and context portrait share this interpretation. Flood and Shadows remain supported. No per-observation illumination inversion is claimed while the image-to-mesh normal/Sun relationship is unknown. The photographed reddish crater region is described in the content, never invented as a texture.

</details>
