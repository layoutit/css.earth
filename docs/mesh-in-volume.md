# A body inside a volume

A proposal. Nothing here is built. What it says about the renderer was read from the code on 18 September 2026, and
the geometry in it was measured with a ray test rather than argued face-on.

Every object this repository draws is either a **body**, a sphere or a shape model, opaque, with a surface, or a
**volume**, a cloud of emission with no surface. The two never share a scene. A star is a body; a nebula is a volume.

Most evolved stars are both. The photosphere is a body, the molecular atmosphere and dust shell around it are a volume,
and the first sits inside the second. This proposes the composition that draws them together, and says what has to be
measured before anyone builds it.

## What exists today

- **The volume frame already places a body.** `DensityVolumeFrame` (`packages/objects/src/density-volume.ts`) carries
  `originM`, the physical position of local `[0, 0, 0]`; `localToReferenceXyzw`, a right-handed orientation into the
  shared frame; `metersPerUnit`; and `boundsUnits`. That is a box in physical space. A body with a known position and
  radius converts into volume units with numbers already in the contract.
- **A volume is three stacks of leaves, all mounted at once.** `PreparedVolumeStack` (`packages/renderer/src/volume/types.ts`)
  names an `axis` and its `PreparedVolumeLeaf` list, each leaf with its `centerUnits` and texture. The runtime
  (`packages/renderer/src/volume/prepared-volume-runtime.ts`) mounts every axis and throws if one is missing. Each stack gets
  its own projection root, flattened (`transform-style: flat` in `styles/volume.css`); inside it the camera, the scene
  and the mesh are `preserve-3d`, and every leaf is a static `matrix3d` plane. The browser depth-sorts those parallel
  planes itself; the runtime never reorders a leaf.
- **The stacks are cross-faded, not swapped.** The runtime weighs each axis by |cos| between its normal and the view
  direction, keeps every axis within 0.16 of the strongest, and blends the visible roots by a smoothstep weight through
  each root's opacity. Zero-weight roots are `display: none`. Every leaf exists as three coincident copies whose opacity
  restores the optical path length at oblique angles; the gain stays under 2.15. Leaves outside the frustum are hidden
  one by one through their `boundsCssPixels`.
- **The isolation of the roots is load-bearing.** `site/test/rendered-page.test.mts` forces `preserve-3d` onto the
  projection roots and requires the rendered light to collapse, because a root that joins the page's 3D context loses
  the per-root opacity mix.
- **A body is a flattened root too.** The shell runtime (`packages/renderer/src/shell/prepared-shell-runtime.ts`) mounts a
  flat root with a `preserve-3d` camera and scene, and the PolyCSS leaves inside keep `preserve-3d`. Betelgeuse's
  prepared tree has 457 nodes.
- **Nothing is drawn inside a volume today.** The Gaia stars around the six prepared nebulae
  (`packages/renderer/src/stars/prepared-catalogue-points.ts`) are a flat overlay at `z-index: 1`, shown when their depth is
  positive: in front of the volume, not among its leaves.

Two flattened roots composite one over the other in DOM order. A body can therefore sit between a stack's leaves only
from inside that stack's 3D rendering context.

## The composition

1. One copy of the body per axis root, inside the stack's mesh element, so it shares the leaves' 3D rendering context.
   The runtime displays only the roots with weight: one most of the time, two inside the 0.16 band, three near a body
   diagonal. In the band each root draws the same body pixels, so the cross-fade leaves the body unchanged and changes
   only the leaves in front of it, as it does today.
2. Inside one 3D rendering context the browser orders planes by depth and, where a leaf plane cuts the body's faces,
   renders the intersection per pixel. The CSS Transforms 2 model says so directly: "if the 3D transforms on those
   elements cause them to intersect, then they are rendered with intersection"
   ([3D rendering contexts](https://drafts.csswg.org/css-transforms-2/#3d-rendering-contexts)). This needs none of the
   things the contract forbids at runtime: no `clip-path`, mask, filter, gradient, blend mode, canvas or WebGL.
3. The cost is the compositor's. Every leaf whose plane crosses the body is split against the body's faces each frame,
   times its active copies, times the roots in the band. That count is not small: the Milky Way bake, the one prepared
   volume on this machine, has 214 leaves per long stack at a single spacing of 0.078 units in a 20-unit box, so a
   photosphere spanning 15% of its box would cross 38 leaves in each long stack. Whether that stays inside the frame
   budget, and whether Chrome, Safari and Firefox split it cleanly, is unmeasured. It is the first measurement below.

### What a baked disc cut does and does not do

A leaf at axial distance `d` from the centre of a body of radius `R` meets it in a disc of radius `sqrt(R^2 - d^2)`.
Cutting that disc from the leaf's texture at preparation removes pixels that could never show, since the photosphere is
opaque. It does not remove the intersection: the plane still crosses the body, so the compositor still splits it. To
spare the split, a crossing leaf would have to be cut into pieces whose rectangles stay clear of the body; an exact
tiling needs unboundedly many pieces, and a few pieces leave a sliver of the annulus uncovered. The bake is a cost
option for the first measurement, not the answer to the composition.

### Ordering by element is exact only on the limb plane

If per-pixel intersection proves too costly, the fallback is to keep the body out of the leaves' context and order
elements: a root of leaves behind, the body, a root of leaves in front. Ordering is exact only for leaves that lie
wholly on one side of the body as seen from the camera, which is not the same as lying on one side of its centre.

Measured with a ray test against a sphere on a 2000 by 2000 grid over the leaf plane, for a leaf at offset `d` seen at
angle `θ` off the stack axis. A leaf placed wholly on its side of the centre, with the disc cut, paints gas over the
far limb. The wrong-side area for the central leaf, as a fraction of the body's silhouette:

| θ off the stack axis | 15° | 30° | 45° | 54.7° |
| --- | ---: | ---: | ---: | ---: |
| Wrong-side area, central leaf | 1.8% | 7.7% | 20.7% | 36.5% |

54.7° is the worst angle three axis-aligned stacks can leave; thirteen stacks would bring it to 27.5°. Leaves with
`|d| >= R sin θ` are correct whole. The others have to be split where the leaf plane meets the **limb plane**, the plane
through the body's centre perpendicular to the view direction, at `x = -d / tan θ` in the leaf's own coordinates,
not at the centre line. A leaf pixel outside the body but inside its silhouette is in front of the body exactly when
it lies on the camera's side of that plane. That rule measured zero wrong-side area at every offset and angle tried;
splitting at the centre line instead left up to 2.5% per leaf. The line moves with the camera, so it cannot be baked;
it would be two overflow-clipped pieces per crossing leaf, repositioned per frame, in two roots per axis. That is the
expensive branch, and it holds only for a sphere or an ellipsoid, whose limb is planar; a shape model's is not.

### Impostors

`PreparedVolumeImpostors` substitutes a projected sprite below `fullBelowDiameterPixels` and returns to the leaves above
`volumeAboveDiameterPixels`. A body inside the cloud has to be baked into those views, or the substitution suppressed
while the body is wider than one CSS pixel; below one pixel the sub-pixel rule already hides it.

## What to measure first

In this order, because each answer can stop the next.

1. **Compositor cost of intersection.** Mount a shipped body's mesh inside one stack of an existing volume and trace a
   drag: frame time with and without the body, and the split count, against the budget in the
   [performance notes](performance/README.md). If it fails, measure the disc-cut and piece-cut bakes before the
   ordering fallback.
2. **Rendered correctness.** Look at the intersection at the default camera and while orbiting, in Chrome, Safari and
   Firefox, including inside a stack cross-fade. The rendered inspection is the gate; a number is not a substitute.
3. **Leaves crossing the body for the real candidate**, at the spacing its bake produces. The count decides whether a
   preparation-time cut of the crossing leaves pays.
4. **The impostor hand-off** with a body inside the cloud.

## What would use it

From the archive audits of 17 and 18 September 2026. Beams across use the resolution of the observation that exists,
capped by its maximum recoverable scale, because an interferometer is a spatial filter and long baselines discard
structure larger than that scale. The cap matters more than the resolution: applied to the archive's own
`spatial_scale_max`, it takes IRC+10216 from the 190 to 285 beams first written down to 11.

The composition only matters where the body and the envelope are visible at the same camera. A shell thousands of
stellar radii out never shows its star as more than a point, and a star buried in its own dust has no photosphere to
draw, so those objects are volumes alone and belong to the [nebula route](nebulae/README.md), not to this proposal.

| Candidate | What the archive serves | Resolution of that observation | Beams across | Filled? | Body and envelope at one camera? |
| --- | --- | --- | ---: | --- | --- |
| **Betelgeuse** | ESO Phase 3 `BETELGEUSE-B`: two ZIMPOL polarimetric images, V and N_I, and two classical images, CntHa and N_Ha, 1024² pixels, December 2024, released 2026-08-19, calibrated | 16 mas, the archive's own `s_resolution` | 7.9 across the shell at 2 to 3 stellar radii | clumpy: "an asymmetric and incomplete dust shell" (Kervella et al. 2016) | yes, and the body is already shipped |
| **L2 Puppis** | ESO raw SPHERE/ZIMPOL, 1,103 public frames | 16.5 × 18 mas, measured on the PSF star | ~11 across the disc rim, ~33 across the field | filled: an edge-on dust disc (Kervella et al. 2015) | yes; needs a new body and the raw route |
| R Doradus | ALMA band 7, 77.5 GB of products | 14.9 mas; recoverable scale 0.42 to 0.66 arcsec across the fine cubes | ~20 across the inner atmosphere | compact, one clump | yes, but the outer envelope is filtered out by the recoverable scale |
| W Hydrae | ESO raw SPHERE/ZIMPOL | 26 × 27 mas, measured | 3.8 | three discrete clouds (Ohnaka et al. 2016) | yes, at four beams |
| IK Tauri | ESO raw SPHERE/ZIMPOL | 20 to 30 mas, stated | 4.0 inner, ~40 diffuse | clumpy (Adam and Ohnaka 2019) | yes, at four beams |
| IRC+10216 | ALMA CO(2-1) mosaic, 6.6 GB of products, calibrated | 0.203 arcsec; recoverable scale 2.27 arcsec | 11 at the recoverable scale, of nested shells 1.5 to 40 arcsec out | fragmented arcs | no: the star is hidden in its dust |
| AFGL 3068 | ALMA CO(2-1) mosaic, 2.4 GB of products, calibrated | 0.162 arcsec; recoverable scale 2.85 arcsec | 18 at the recoverable scale, of a spiral | fragmented | no: the star is hidden in its dust |
| R Sculptoris | ALMA band 3 mosaic, 176 GB | 0.386 arcsec; recoverable scale 7.5 arcsec | 19 at the recoverable scale, of a shell 19.5 arcsec out | largely continuous | no: the star is a point at that camera |
| SiO maser shells, TX Cam and R Cas | VLBA raw correlator output, `Do Not Calibrate`, 1,033 and 643 public blocks, median 0.36 GB each | 0.476 mas, the 540 × 420 µas beam of Diamond and Kemball 2003 | ~66 across a zone centred at 15.8 mas | never filled: around 100 spots (Gonidakis et al. 2010) in a thousand or more beam areas | no: TX Cam has no measured diameter to make a body from |
| Planetary nebulae, NGC 6302 and NGC 6543 | JWST MIRI MRS cubes, public, 414 MB and 226 MB | 0.13 arcsec spaxels | 69 and 59 | filled | no body inside |

JWST holds no observation of any evolved star on this list, and Hubble holds images rather than cubes. Both audits
close the question rather than open one.

**Betelgeuse is the case to build against**: a shipped body with an envelope the archive serves calibrated. The dust
shell is in the polarimetric pair and the degree-of-polarisation maps served beside them; the classical pair was taken
for the companion search that the release's paper reports (Montargès et al. 2026). L2 Puppis is the better structure,
the only filled and continuous one in the audit, but it is raw frames around a body that does not exist here.

Each of these datasets is an image or a spectral cube, not a density. A volume made from one is a display emission
model under a stated symmetry or kinematic assumption, the same limit every prepared nebula carries, and its ledger
entry has to say which model.

### What was measured and what is carried

Re-measured against the archives on 18 September 2026: every `BETELGEUSE-B` row (ESO TAP `ivoa.ObsCore`); the L2 Puppis
frame count and the VY Canis Majoris `NO NAME` filing (ESO TAP `dbo.raw`); the JMDC rows for R Cas and TX Cam (VizieR
`II/345`); the maser-zone and beam figures (Diamond and Kemball 2003); the ALMA resolutions and recoverable scales (ALMA
TAP `ivoa.obscore`, whose `access_estsize` is null everywhere, so sizes come from DataLink's per-tar `content_length`);
the NRAO block counts, sizes and the two negative cones (the portal backend at
`data.nrao.edu/archive-service/restapi_get_paged_exec_blocks`); and the NGC 6302 cube size (MAST). The occlusion table
above is this document's own ray test. Carried from the audit as recorded in
[pull request 310](https://github.com/layoutit/css.earth/pull/310), not re-measured: the ZIMPOL resolutions measured on
PSF stars, the structure sizes the beam counts divide, and the JWST and Hubble holdings.

Sources: Kervella et al. 2016, [10.1051/0004-6361/201527134](https://doi.org/10.1051/0004-6361/201527134);
Kervella et al. 2015, [10.1051/0004-6361/201526194](https://doi.org/10.1051/0004-6361/201526194);
Ohnaka et al. 2016, [10.1051/0004-6361/201628229](https://doi.org/10.1051/0004-6361/201628229);
Adam and Ohnaka 2019, [10.1051/0004-6361/201834999](https://doi.org/10.1051/0004-6361/201834999);
Montargès et al. 2026, [10.1051/0004-6361/202661023](https://doi.org/10.1051/0004-6361/202661023);
Diamond and Kemball 2003, [astro-ph/0310684](https://arxiv.org/abs/astro-ph/0310684);
Gonidakis, Diamond and Kemball 2010, [10.1111/j.1365-2966.2010.16714.x](https://doi.org/10.1111/j.1365-2966.2010.16714.x).

## What this is not

- **Not a way to show gas inside a star.** The photosphere is opaque; what lies inside the body and behind it is hidden,
  correctly.
- **Not a depth reconstruction.** A spectral cube's third axis is velocity, which is measured. Converting velocity to
  depth is a model and a separate proposal. For maser emission it is not falsifiable at all: tangential amplification
  beams the light toward the observer where the line-of-sight velocity is near zero, so an inversion would place every
  spot near the plane of the sky because that is where every spot was detected.
- **Not a change to the volume format.** Everything above uses `PreparedVolumeStack` and `DensityVolumeFrame` as they
  stand.
