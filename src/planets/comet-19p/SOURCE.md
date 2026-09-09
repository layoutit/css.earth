# Borrelly: terrain and encounter photography

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

## Source survey and restoration

| Candidate | Disposition |
| --- | --- |
| PDS USGS and DLR DEM tables | Included; reviewed terrain and independent reconstructions. |
| Mission orthophoto with original XYZ cubes | Included; exact registration is independently verified, with the rescued-website qualification retained. |
| Individual raw MICAS near/mid images | Retained as archive references; the mission orthophoto provides the documented terrain registration. No independently qualified multi-frame photometric mosaic is claimed. |
| Published photometric/albedo analysis | Paper evidence only; no separate machine-readable, registered scalar release was established in the consulted DEM and rescued-website archives. |
| Press images and 8 × 4 × 4 km illustrations | Useful context only; they do not close the unobserved surface. |

All inputs and source documents are pinned in `source/manifest.json`.
`pnpm setup:assets --object=comet-19p` installs the prepared runtime without
source processing. `node tools/restore-source-inputs.mjs --object=comet-19p`
restores missing original inputs through the authored acquisition plan;
`node tools/objects/dist/prepare-authored.js comet-19p --write` rebuilds the
scene with the shared preparation tools. The registration audit is under
`tests/objects/oracle/comet-19p/registration.py` and requires NumPy and SciPy.
The broader qualification and delivery evidence is in
[`docs/comets/BORRELLY.md`](../../../docs/comets/BORRELLY.md).
