# Borrelly: encounter terrain and photography

Borrelly adds a seventh comet through the same object adapter and retained scene. Five datasets belong to one scene: MICAS photography, USGS terrain, DLR terrain, USGS image-plane height, and the difference between the registered terrain models. Qualification is in progress; this document is not yet a merge-readiness claim.

## What the sources establish

The [reviewed PDS DEM release](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/) contains 62,879 USGS XYZ/normal rows and 3,765 DLR XYZ rows. Both describe the visible terrain from the 22 September 2001 encounter. Neither closes the unobserved side. The viewer adds an illustrative completion fitted to each outline, with the shared missing-data grid on every added face. It carries no observed texture or scalar values.

The USGS grid is sampled every 16 m. That is an oversampled representation, not 16 m imaging resolution. [The mapping paper](https://www.isprs.org/proceedings/xxxiv/part4/pdfpapers/277.pdf) describes an original 150 m stereo grid and a highest-resolution image near 46.6 m/pixel. Height is displacement toward the camera above an arbitrary plane, not distance along gravity or from the nucleus centre. Negative and zero values remain valid.

The [rescued mission website](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-3-rdr-visccd-borrelly-v1.0/document/derived/topo/topo.htm) supplies a rectified MICAS image and its XYZ cubes. PDS explicitly identifies this collection as insufficiently documented for formal review. We use its photograph with original illumination and do not claim to requalify radiometric calibration. Every valid XYZ pixel matches exactly one reviewed USGS post, and every post is accounted for. Maximum height difference is 0.000000500001 m, consistent with decimal rounding of the released ASCII table. Pixel coordinates are exactly `X = 16*sample - 3144`, `Y = 3448 - 16*line`, with zero-based indices. This establishes image placement independently of appearance.

The original image and terrain masks agree at all 170,168 pixels. Bilinear sampling requires four valid image contributors and a source-surface correspondence within 85 m. Gray edge pixels denote missing photographic support. Uniform lighting retains the photographed illumination; the Shadows setting adds an illustrative fixed-epoch lighting bank.

## Comparing USGS and DLR

DLR X/Y are pixels, while USGS X/Y are metres. The archive only gives an approximate DLR scale. The paper describes a separate registration procedure and does not provide its final transform. The comparison therefore uses an explicitly derived image-plane similarity registration, with a vertical datum offset. It does not claim to reproduce the authors' original affine comparison or its 120 m statistic.

Registration uses every thirteenth DLR post as controls. Remaining posts are held out. Repeating the fit for all thirteen control offsets measures sensitivity to the chosen controls. The preliminary held-out RMS range is about 200–206 m, with image-plane positions differing by up to 215 m across these fits. These are empirical model/alignment differences, not accuracy against ground truth. The Difference dataset must be read with this qualification.

Only triangles supported by both releases contribute to the difference. USGS height minus registered DLR height is expressed in kilometres. No missing edge is extrapolated. The two terrain views share the same physical coordinate conversion and camera.

## Geometry and placement

The USGS display mesh has 1,999 triangles and retains all 1,269 boundary edges. DLR uses a separate approximately 1,400-triangle bank and retains its 373 boundary edges and three holes. Image-plane reduction preserves the source posts and repairs internal diagonals that would otherwise produce folded or vertical triangles. Topology and every boundary edge are checked after reduction.

The USGS envelope is reduced as one closed mesh to 1,966 triangles: 890 use original source posts and 1,076 involve estimated geometry. DLR retains 1,399 source and 1,625 estimated triangles (3,024 total). Both completed meshes are closed, outward wound, connected and genus zero. The original outline constrains the initial envelope; a second USGS reduction removes redundant boundary detail while retaining the 85 m sampled source-fit limit. The rear depth scale is assumed to be 3.15 km, using the width reported by [Buratti et al. (2002)](https://pubs.usgs.gov/publication/70024562). This does not establish a measured third axis or hidden terrain. The source package records the equation and assumptions.

Independent checks sample every source vertex and face centroid toward the measured display mesh, and every measured display face centroid and edge midpoint in reverse. They are sampled distance checks, not continuous Hausdorff bounds. The USGS maxima are 80.18 m from source to display and 61.39 m in reverse; DLR maxima are 74.10 m and 56.84 m. Estimated completion faces are excluded. Material transfer independently applies the same 85 m limit at every prepared texel.

The source height datum is preserved in the Height view. A common 2.2 km translation recentres the presentation and does not assert a measured centre of mass. The 4 km navigation reference is half NASA's reported approximate 8 km nucleus length; it is not a volume or mean radius. Geometry retains its actual source dimensions.

JPL Horizons elements and independent vectors use the shared JD 2461286.5 epoch. The central-epoch position differs by less than 1 mm; measured conic errors at minus/plus 30 days are 356.11/337.54 km, under a 410 km regression guard and the existing 10,000 km nearby-placement budget. Attitude and phase are explicitly illustrative. No 2026 spin solution or long-term ephemeris is claimed.

## Remaining qualification

- Finish registration evidence and sensitivity checks, including the rendered Difference legend.
- Review all five datasets in real Chrome at DPR 1 and 2; inspect measured edges, gap fills and the gridded unobserved side.
- Verify camera preservation, retained DOM, source-owned surface targeting, drag, wheel and navigation.
- Verify fresh source restoration and runtime asset download, with hashes of actually loaded browser bytes.
- Complete focused and shared package/browser gates, document aggregate limitations, and prepare the PR.
