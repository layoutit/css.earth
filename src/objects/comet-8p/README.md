# Tuttle: source and interpretation

Tuttle compares two smooth inferred nucleus shapes: Hubble light-curve proportions scaled by Spitzer, and a separate Arecibo radar model.

The Hubble · Spitzer view has two labels for its **model anatomy**: Large lobe
and Small lobe. They mark the analytic contact-sphere model only.
Their Cartesian positions use its equal-density centroid and arbitrary meridian;
they are not observed terrain, named geography or Arecibo labels.

## Sources

| Model or quantity | Source |
| --- | --- |
| Hubble · Spitzer shape and size | [Groussin et al. (2019)](https://arxiv.org/abs/1911.04897) |
| Arecibo shape and synodic period | [Harmon et al. (2010)](https://echo.jpl.nasa.gov/asteroids/harmon.etal.comet.tuttle.pdf) |
| Placement and observational comparisons | Retained JPL Horizons responses and independent vectors |

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

- **Label discovery, 2026-09-12:** the [whole-body discovery check](../../../tests/objects/unit/surface-feature-discovery.test.mts) verifies earlier eligibility for the broad surface places. Only the prepared zoom thresholds changed; coordinates, captions, mesh and imagery match the preceding version.

The recorded independent checks compare Spitzer viewing angles with the paper and test the osculating position against JPL vectors. [Raw responses](source/reference/) are retained. Those earlier checks have no cited browser report.

For the surface-place addition on base `53b262bd`, browser checks on 2026-09-12 covered both lobe searches and camera arrivals. Switching to Arecibo hides these labels; searching for one there selects the matching Hubble · Spitzer model. Shadows stayed Off. The runtime parser accepted both entries and a fresh download matched the published catalog's byte count and SHA-256. Surface assets are unchanged.

## Known problems

- Both shapes are inferred from limited observations; neither supplies resolved terrain or a surface photograph.
- The default pole has uncertainty and an arbitrary rotation phase. The radar comparison uses an illustrative alignment.
- Equal-density origins are assumptions. Gray material is not albedo, and mesh-reduction estimates are not continuous error bounds.
- The contact point is omitted: the shared camera approach would hide it behind the nearer lobe, making its label misleading.
- The conic omits perturbations and outgassing; its ±30-day comparison is not a long-term ephemeris.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Shape selection and observational limits</summary>

The default **Hubble · Spitzer** view uses the Hubble contact-sphere model favored
by [Groussin et al. (2019), A&A 632, A104](https://arxiv.org/abs/1911.04897).
Its lobe proportions come from optical brightness variations; Spitzer thermal
measurements constrain the overall size. This is a smooth inferred nucleus,
not resolved terrain or a photograph. No coma, tail or surface markings are
invented. The selected numerical parameters and their uncertainties are checked
in under `source/shape/model.json` and pinned in `source/manifest.json`.

**Arecibo** is a second, separate inferred shape from
[Harmon et al. (2010)](https://echo.jpl.nasa.gov/asteroids/harmon.etal.comet.tuttle.pdf),
Section 3. Its prolate lobes have full dimensions 5.75 × 4.11 × 4.11 km and
4.25 × 3.27 × 3.27 km. The checked-in semiaxes divide those numbers by two;
no Spitzer flux scaling is applied. Their combined length is 10.0 ± 0.9 km.
The 11.385 ± 0.004 h radar period is synodic. The images had 300 m range
resolution and limited aspect coverage; neither the images nor the smooth fit
provide resolved global terrain. This dataset uses the original 2010 dimensions,
not the slightly rounded semiaxes in the 2019 comparison table.

The Arecibo axes are aligned with the default model for comparing shapes. The
2010 radar observations did not determine a unique spin pole, and this view does
not apply the later candidate pole or reproduce an observed rotation phase.
The visible dataset explanation identifies this illustrative alignment. Each
model has its own equal-density volume origin, expressed in the same physical
metre scale; the default model continues to supply the common reference radius.

</details>

<details>
<summary>Size, scale, pole and coordinates</summary>

## Size and coordinates

Table 3 gives the HST model two touching spheres with radii 2.8 and 1.2 km.
Section 5.3 gives a thermal flux scale gamma = 0.90 ± 0.09. Since flux scales
with projected area, lengths are multiplied by **sqrt(gamma)**. The prepared
radii are therefore 2.6563132345 and 1.1384199577 km, preserving the original
7:3 ratio. The factsheet rounds these to about 2.7 and 1.1 km. The paper reports
uncertainties of ±0.1 km for each rounded value. Using those rounded values to build the mesh would change its
proportions.

Body X joins the lobe centres; body Z is perpendicular to X and follows the
model spin pole. The origin is the equal-density volume centroid. Equal density
is a modeling assumption, not a measured centre of mass. The reference radius
2.7242595838 km is the equivalent-volume radius of the two analytic spheres;
it supplies the generic world scale. No mass or GM is claimed.

The source pole is RA 285 ± 12°, Dec +20 ± 5°. The scene holds a fixed arbitrary
rotation phase; it does not propagate the observed approximately 11.4-hour
rotation period to 2026. The illumination represents that chosen phase. Neither
a current attitude solution nor the 2008 encounter geometry is implied.

</details>

<details>
<summary>Prepared geometry and material</summary>

## Preparation

The shared `contact-ellipsoids` loader tessellates the two lobes into 4,096
triangles in metres. It preserves separate surface normals at the contact and
passes full connectivity through the existing source-mesh path. The two lobes
are not resampled as a single radial globe or joined by an invented neck.

Meshoptimizer 1.2.0 reduces this to 1,000 native PolyCSS triangles with a 50 m
error allowance. The source contact position is locked. The estimated error is
31.30 m; this is a simplifier estimate, not a Hausdorff bound or measurement
uncertainty. The final topology has 503 vertices, 1,500 edges and Euler
characteristic three: two closed lobes sharing one point. Independent checks
compare retained vertices and triangle centroids with the analytic spheres,
verify the exact contact and check finite normals.

The Arecibo model independently follows the same source-mesh route with a 75 m
error allowance and its own geometry, lighting banks and thumbnail. Both sets
of 1,000 leaves are prepared and retained in one scene; only the selected set is
displayed. Prepared triangle ranges make surface picking follow the committed
dataset. A lens change does not generate geometry, mount another object or move
the shared camera.

A uniform #b8b6b2 material makes the geometry readable. It is an illustration,
not a measured albedo. The existing preparation pipeline bakes source-mesh
normals, directional shadows and flood lighting into fixed triangle atlases.
Navigation context is rendered from the same reduced geometry and material.
The browser consumes prepared data through the shared retained-DOM scene.

</details>

<details>
<summary>Independent observational checks</summary>

## Independent observational checks

The model pole and independent JPL Horizons vectors from Spitzer to Tuttle give
aspect angles 91.8885° on 2 November 2007 and 65.0219° on 22 June 2008. These
agree with the paper's rounded 92° and 65°. The checks also reproduce its
approximately 2.9 km broadside equivalent-area radius. The raw query responses
are preserved under `source/reference/`.

Heliocentric placement uses JPL Horizons `DES=8P;CAP;`, centre `500@10`, ICRF,
at JD 2461286.5 (3 September 2026). The independent vector residual is about
1.3 mm at the prepared epoch and below 438 km at ±30 days. The osculating conic
omits perturbations and outgassing; this is not a long-term ephemeris. TDB is
approximated as TT within 2 ms, following the shared astronomy convention.

</details>

<details>
<summary>Credits</summary>

Credits and restoration pins remain beside the package. Source papers are cited, not
relicensed as cssEarth assets.

</details>
