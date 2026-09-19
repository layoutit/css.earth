# Neptune

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

The visible-detail globe is the 2025 Hubble OPAL Cycle 32 colour global map
assembled by the OPAL team from WFC3/UVIS F467M, F547M, and F657N exposures.
The OPAL readme declares that the TIFF is arbitrarily scaled and contrast
enhanced, so
the normal lens does not publish those display values as literal true colour.
Preparation matches the mean and channel variation of a checked equatorial OPAL
sample to the unobscured central region of the 2024 Irwin et al. true-colour
Neptune reconstruction distributed by the Royal Astronomical Society. The
calibration reference is committed under `source/color/` with CC BY 4.0
attribution. The methane lens uses the matching FQ619N global map and the
near-infrared lens uses F845M. Their checked FITS and TIFF products, plus the
OPAL readme, are in `source/opal/`. Preparation converts them to fixed runtime
rasters; the browser does not parse FITS, TIFF, or the calibration reference.

The prepared scene uses the 24,764 km equatorial and 24,314 km polar radii
(IAU 2015 report values). JPL Solar System Dynamics discovery, mean-elements, and
physical-parameter tables supply the prepared 16-moon catalog. The PDS Rings
Node Neptune table supplies the prepared ring radii and widths.

Two panel charts are prepared from the committed NASA GSFC Planetary Spectrum
Generator configuration and raw I/F response; the third uses the pinned
photometric phase coefficients. The panel prose and facts are prepared from
the committed NASA Science `Neptune: Facts` snapshot.

## Evidence

- **Normal polar source sampling, 12 September 2026:** the staged normal-pole
  refresh verified the OPAL TIFF, the Irwin et al. colour reference, the
  observation recipe, source manifest and retained scene pin. It applied only
  `neptune-poles-normal.webp`: the fixed 512 × 128 atlas changed from 4,538 to
  4,524 bytes, a 14-byte (0.31%) smaller download. The normal surface bands,
  thumbnail, material assets and retained geometry were not regenerated. This
  is preparation evidence, not a browser review.
- **Ring wedges, 19 September 2026:** the ring is 16 wedges in one atlas at the
  canonical density. Laid back into the ring plane, the wedges match the single
  ring image they replace to a mean alpha error of 1.03/255 inside a wedge and
  1.30/255 within 2 px of a wedge boundary. The package tests left from the
  earlier lane are retired and the rest pass.

## Known problems

The OPAL global maps contain no observed samples north of approximately +30
degrees latitude for this observing geometry. Preparation extends the checked
+30-degree boundary row toward that row's longitudinal mean at the pole. This
source-derived coverage treatment supplies no new storm or cloud detail. It is
recorded in `source/preparation/observations.json` and happens only during preparation.

The normal OPAL map is a 720 × 360 global raster. Its declared high-latitude
coverage continuation and colour calibration run before the normal pole atlas
samples that grid directly. The existing 2,880 × 1,440 same-aspect resize still
serves the normal surface bands, but it is no longer an intermediate for the
pole atlas. The fixed direct-segment, bilinear-wrapped projection remains four
128-pixel pole tiles in a 512 × 128 file. This preserves the existing
projection and retained 724-leaf scene; it does not establish a new geographic
registration or recover unobserved polar features.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="neptune-source-record"></a>
<a id="planet-surface-and-observation-lenses"></a>
<a id="shape-satellites-and-rings"></a>
<a id="atmosphere-facts-and-sky"></a>

<details>
<summary>Methods and source notes</summary>

**Planet surface and observation lenses**

Each lens is mapped across 722 surface leaves on the shared sphere lane: 720
longitude-latitude cells and two polar caps. The orientation is solved from
Neptune's pole and rotation at the scene epoch; the hand-typed rotations it
replaced were about 65° off. Lighting is one 256-frame bank indexed by the
Sun's direction in view and shared by every lens; it carries no atmospheric-limb
overlay. The rings are 16 wedges drawn from the ring recipe, the Adams arcs
included, and each starts outside the planet so the planet hides their far side.
No ordinary image element or planet-sized background `<div>` is generated or
mounted. Runtime only selects and decodes prepared assets; it performs no
source projection, lighting, filtering, or raster work.

**Shape, satellites, and rings**

The scientific satellite catalog remains pinned source material. The shared
runtime mounts exactly one detailed object scene, so dormant moon-dot,
orbit-guide, and obsolete orbit-bank derivations are not part of its active
asset closure. `object.json` records the exact retired filenames; their source
snapshots remain available without treating an embedded moon system as the
active Neptune scene.

</details>
