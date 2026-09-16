# Borrelly: terrain and encounter photography

Borrelly compares two reconstructions of the Deep Space 1 encounter terrain and a registered MICAS photograph. The unobserved rear is an explicitly estimated completion.

## Sources

The panel's editorial credit is NASA's 19P/Borrelly overview: <https://science.nasa.gov/solar-system/comets/19p-borrelly/>.

| View or quantity | Source |
| --- | --- |
| USGS and DLR terrain | [Reviewed PDS DEM release](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/), September 2001 encounter |
| MICAS photograph | [Mission orthophoto and XYZ cubes](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-3-rdr-visccd-borrelly-v1.0/document/derived/topo/topo.htm) |
| Height and difference | Source Z and USGS-minus-registered-DLR Z, in kilometres |

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

- **Label discovery, 2026-09-12:** the [whole-body discovery check](../../../tests/objects/unit/surface-feature-discovery.test.mts) verifies earlier eligibility for the broad surface places. Only the prepared zoom thresholds changed; coordinates, captions, mesh and imagery match the preceding version.

The [9 September 2026 browser record](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/evidence/borrelly/browser.json) covers five datasets, lighting states, DPR 1/2 and a fresh asset installation. The [qualification report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/BORRELLY.md) links source-fit, registration and capture evidence. These are recorded results; they do not establish physical-mobile performance or a fresh unrestricted all-body preparation run.

Four terrain places follow [Britt et al. (2004), Figs. 1 and 4](https://doi.org/10.1016/j.icarus.2003.09.004): Upper Mottled Terrain, Central Mesas, Central Smooth Terrain and Lower Mottled Terrain. Image controls transfer selected interiors from the published unit map to the native MICAS orthophoto and XYZ cubes. The map-to-photo fit has 55 withheld controls (1.41 pixels RMS, 5.43 maximum); the photo-to-orthophoto fit has 32 (1.10 native pixels RMS, 2.19 maximum). These measure image correspondence, not absolute geological accuracy. [Recomputed placements](source/features/evidence/image-landmarks.json) retain both fitted and withheld residuals.

The [terrain-place browser record](evidence/terrain-places/browser.json) covers all four search flights at 1440 × 900 and 390 × 844 on main `e986b9280` plus this change. Inspected [desktop](evidence/terrain-places/desktop.png) and [mobile viewport](evidence/terrain-places/mobile.png) captures show the MICAS labels and qualified captions. Shadows stay Off, all 2,856 retained leaves survive the selections, and switching to DLR hides the labels. Sixteen focused tests, preparation build/typecheck, coordinate reproduction and both changed bodies' provenance pass. Aggregate source preparation is blocked by unchanged Earth, Moon and Mars recipe pins on that main revision; full browser conformance was not rerun.

- **Reader oracle, 2026-09-12:** `tools/oracles/isis2/borrelly-micas.py` reads the four pinned MICAS cubes with pvl and numpy. `tools/objects/terrestrial-layers/isis2-qube.oracle.test.mts` requires 48 sampled core values per cube to match exactly and the valid and special-pixel counts to agree.

### Registration

<!-- registration-report:begin --><!-- registration-report:end -->

## Known problems

- The 16 m USGS grid oversamples roughly 150 m stereo terrain. Height is displacement above an arbitrary image plane.
- The orthophoto comes from a rescued website outside formal PDS product review; verified placement does not establish radiometric calibration.
- Model differences include registration sensitivity of about 200–206 m RMS. They are not physical change.
- The gridded rear and 3.15 km depth are assumptions. Sampled geometry checks are not continuous error bounds.
- Terrain labels are limited to the MICAS source-range mesh. They do not apply to the estimated rear, the DLR alternative, or a terrain-unit boundary.
- Lower Smooth Terrain remains withheld: its selected source point is too close to the photograph's support edge for the broad placement check. The four included places remain approximate and carry that qualification in their captions.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Reproducing terrain places</summary>

The [control measurements](source/features/control-measurements.json) retain two image matches: the annotated unit map to its unannotated photograph, then that photograph to the archived orthophoto. Interior patches use fixed checkerboard fit/holdout partitions; white map annotations, weak matches and ambiguous matches are excluded before fitting. Every retained control contributes to the reported residuals. Initial image alignment and the fitted correction are separate in the recipe.

The [landmark recipe](source/features/image-registration.json) pins those measurements and all four native cubes. `node tools/objects/surface-features/project-orthophoto-landmarks.mts comet-19p` recomputes the affine fits, reads each XYZ sample and compares the resulting landmarks and evidence. The 16 m sample spacing oversamples the roughly 150 m source terrain. Subpixel image residuals do not increase that terrain resolution.

Preparation applies the existing −2200 m Z translation once and attaches each point to the unchanged display within 85 m. Since this image-plane datum is arbitrary, a radial direction can point through the gridded rear. These labels opt into the local display facet's normal for facing and the existing camera flight. Neither the renderer nor the mesh changes.

</details>

<details>
<summary>Selected terrain and photograph products</summary>

The [reviewed PDS terrain release](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/)
contains independent USGS and DLR reconstructions of the September 2001 Deep
Space 1 encounter. They are open, observed surfaces. The viewer adds an
explicitly estimated completion, marked with the missing-data grid. The two models share physical metres and a
camera; the DLR dataset switches to its own retained geometry.

USGS supplies 62,879 XYZ/normal rows in metres. The released 16 m grid is
oversampled: the original stereo grid was about 150 m, and the best encounter
image was about 46.6 m/pixel. DLR supplies 3,765 XYZ rows, with X/Y in image
pixels and Z in metres. Height means displacement toward the observer from an
arbitrary image plane. Negative and zero heights are valid. These coordinates
do not establish a closed volume, centre of mass or gravity field.

## Selected datasets

| Dataset | Source and interpretation |
| --- | --- |
| MICAS | The mission team's rectified photograph, registered to the USGS terrain through its original XYZ cubes. Original illumination is retained; brightness is not presented as albedo. |
| USGS | Reviewed stereo terrain, including manual stereo editing, with neutral material. |
| DLR | Independent reviewed stereo terrain, registered into the USGS image plane. |
| Height | USGS source Z in kilometres, before the presentation translation. |
| Difference | USGS Z minus registered DLR Z in kilometres, only where both released surfaces exist. This is model disagreement, not physical change. |

The [mission orthophoto and coordinate cubes](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-3-rdr-visccd-borrelly-v1.0/document/derived/topo/topo.htm)
are from a rescued website. PDS explicitly did not qualify that collection as a
formally reviewed data product. The original 356 × 478 ISIS2 cubes contain
62,879 valid pixels. All four masks agree, and each XYZ pixel identifies one
reviewed USGS post, accounting for every post. Zero-based pixel coordinates
obey `X = 16*sample − 3144`, `Y = 3448 − 16*line`. The maximum Z discrepancy
is below 0.000001 m, consistent with ASCII rounding. This verifies placement,
not radiometric calibration. The fixed display interval is 0–0.018; no local
contrast enhancement or photometric correction is added to the photograph.

</details>

<details>
<summary>Registration, sampled errors and estimated completion</summary>

## Registration and geometry

The [mapping paper](https://www.isprs.org/proceedings/xxxiv/part4/pdfpapers/277.pdf)
describes registration between models but does not publish the final transform.
Our five-parameter similarity and vertical-datum fit is recorded in
`source/reference/registration.json`. DLR height scale is unchanged. Every
thirteenth post supplies controls; all other posts are held out. Repeating
across thirteen control subsets gives held-out RMS differences of 200–206 m
and a maximum XY displacement of about 215 m between fits. This is empirical
alignment sensitivity, not ground-truth accuracy. The authors' 120 m statistic
is not claimed for this different comparison.

An intermediate reduction retains 1,999 USGS and 799 DLR triangles with
all original boundary edges. Sampled source-to-display distances are
below 110 m, checked independently in both directions. Those finite samples
are not a continuous Hausdorff bound. Each photographic/scientific texel must
also find a full-source correspondence within 85 m. Invalid contributors and
non-overlapping comparison regions receive the shared missing-data treatment.

The USGS envelope is reduced as a closed mesh to 994 native triangles;
452 use original source posts and 542 contain estimated geometry. DLR
retains 799 source triangles and 1,063 estimated triangles (1,862 total),
including 62 across three source gaps. The resulting meshes are connected,
closed and consistently outward wound, with Euler characteristic two.

The final USGS surface is checked again against the complete source DEM.
Source fit is a geometric accuracy check; it does not turn the hidden surface
into a measurement. Every face involving an inferred rear vertex is forced
to the grid, as are texels outside the original source footprint. Both science
and photography still require a valid source correspondence within 85 m.

`source/reference/completion.json` specifies the illustrative depth envelope.
[Buratti et al. (2002)](https://pubs.usgs.gov/publication/70024562) report an
8.0 by 3.15 km nucleus; using that width as a 3.15 km depth scale is our
assumption, not a measured third axis. The rear height field is offset below
the observed front and tapers to its outline before closed-mesh reduction.
It inherits the height field's relief and noise. This is not a released closed
shape model, a volume measurement or new geology. Estimated geometry receives
the grid in every dataset, including thumbnails and context images. Source-fit
measurements exclude those estimated faces.

A common 2.2 km translation recentres the display. The 4 km navigation radius
is half the approximately 8 km observed length, not a measured mean radius.
JPL Horizons elements and independent vectors use JD 2461286.5. The rounded
released image Z direction anchors an illustrative attitude; no current spin
solution or encounter attitude is reconstructed. Shadows adds an illustrative
fixed-epoch light to the photographed shading; uniform lighting preserves the
original image. Both states remain available.

</details>

<details>
<summary>Restoration and evidence links</summary>

All inputs and source documents are pinned in `source/manifest.json`.
The [contributor guide](../README.md) covers shared commands. The body-specific
registration audit is under `tools/oracles/comet-19p/registration.py`
and requires NumPy and SciPy.
The broader qualification and delivery evidence is in
[`docs/comets/BORRELLY.md`](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/comets/BORRELLY.md).

</details>
