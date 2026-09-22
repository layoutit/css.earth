# Annefrank

Stardust visited Annefrank in 2002.

## Sources

Published preliminary ellipsoid using minimum full dimensions from Stardust flyby images. It does not reproduce the observed angular outline or establish a complete global shape. Full approximation dimensions: 6.6 × 5 × 3.4 km. Arbitrary display pole and meridian. The flyby did not establish a spin pole or current surface longitude; the display orientation is not a measured attitude. The grid marks unmapped terrain.

Source: [Duxbury et al. (2004), Journal of Geophysical Research: Planets 109, E02002](https://doi.org/10.1029/2003JE002108). Checked 2026-09-09. The full axes are halved once; the reference radius is the geometric mean of these semiaxes. This is the approximation's rendering scale, not an independent observed radius or the volume of the original convex reconstruction. Formal axis uncertainties are included only where the source supplies them.

The mission's own constants kernel
[sdu_annefrank_v01.tpc](https://naif.jpl.nasa.gov/pub/naif/pds/data/sdu-c-spice-6-v1.0/sdsp_1000/data/pck/sdu_annefrank_v01.tpc)
carries the same radii and leaves the pole and prime meridian empty, stating that
the flyby was too short to determine a spin axis or rotation rate. Checked
2026-09-15. Annefrank therefore has no body-fixed frame in the mission archive,
which is why the display pole and meridian here are authored.

## Evidence

The Stardust photographs and their camera were retrieved and measured on
2026-09-15, and a registration onto this ellipsoid was attempted and failed. The
numbers, inputs and the reason are recorded in the
[investigation ledger](investigations.json). In short: the archived camera is
sound, and across six frames it predicts the observed disc to a constant offset
of 12.2 and 6.7 pixels with about 0.8 pixel of scatter. Fitting the ellipsoid's
orientation to 403 limb points from eight frames that span 95 degrees of viewing
direction reached 3.6 pixels root mean square; frozen and applied to an unused
frame it gave 6.3 pixels, or 1240 m on a body 6.6 km long. A single frame shows
at most half of its limb lit, and the archive's scattered light biases a simple
edge inward, so the lit arc alone does not fix the outline. No photographic
surface is qualified from this attempt.

## Known problems

- Stardust images exist and resolve the body across about 36 pixels, but no registered global surface mosaic is qualified for this approximation. Integrated spectra are not surface maps.

- The asteroid has no published pole, prime meridian or rotation period, so no archived route turns a camera into surface longitude and latitude here.

- Original closed scientific mesh and registered surface mosaic were not located in the checked Stardust archive.

The [Stryk and Stooke (2016) partial map](https://www.hou.usra.edu/meetings/lpsc2016/pdf/1148.pdf)
is a promising alternative, checked 2026-09-13. Its authors corrected mirrored
Stardust images, removed scattered light and stacked frames. The raw archive
frames are mirror-reversed by the camera's scan mirror, and the authors note that
earlier publications show that reversed orientation. Figure 4 uses
tentative ellipsoid control, not a high-precision shape solution. The figure
does not supply labelled longitude bounds or a reusable raster release with
clear derivative terms. It is not yet registered to this display ellipsoid;
the map's existence does not qualify a surface texture here.

- The reported 6.6 × 5.0 × 3.4 km dimensions are minimum extents from limited viewing, not three exact global axis measurements.

- The real body has angular surfaces that this preliminary ellipsoid does not reproduce.

- Neither the arbitrary display pole nor its zero meridian is an observed physical orientation.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="shape-scale-and-orientation"></a>
<a id="source-survey"></a>
<a id="orbit"></a>
<a id="reproduction"></a>

<details>
<summary>Methods and source notes</summary>

**Shape, scale and orientation**

The [measurements](source/measurements.json) record the radius-table formula and
pole conversion. The [table tool](../../../tools/objects/source-authoring/README.md)
reproduces the pinned radii. The [navigation recipe](source/preparation/navigation.json)
records the context image; shared preparation produces the scene.

**Source survey**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

**Orbit**

JPL Horizons command "5535;"; osculating ICRF elements and independent vector fixtures use the existing astronomy generator at 2026-09-03 TT (TDB approximated as TT, below 2 ms). This is a fixed-date context, not a real-time trajectory or surface attitude.

</details>
