# Tuttle: source and interpretation

Tuttle compares two smooth inferred nucleus shapes: Hubble light-curve proportions scaled by Spitzer, and a separate Arecibo radar model.

The Hubble · Spitzer view has two labels for its model anatomy: Large lobe and Small lobe. They mark the analytic contact-sphere model only. Their positions use its equal-density centroid and arbitrary meridian; they are not observed terrain, named geography or Arecibo labels.

## Sources

| Model or quantity | Source |
| --- | --- |
| Hubble · Spitzer shape and size | [Groussin et al. (2019)](https://arxiv.org/abs/1911.04897) |
| Arecibo shape and synodic period | [Harmon et al. (2010)](https://echo.jpl.nasa.gov/asteroids/harmon.etal.comet.tuttle.pdf) |
| Placement and observational comparisons | Retained JPL Horizons responses and independent vectors |

The [investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying.

## Evidence

The model pole and independent JPL Horizons vectors from Spitzer to Tuttle give aspect angles 91.8885° on 2 November 2007 and 65.0219° on 22 June 2008. These agree with the paper's rounded 92° and 65°. The checks also reproduce its approximately 2.9 km broadside equivalent-area radius. The osculating position is tested against JPL vectors: the residual is about 1.3 mm at the prepared epoch and below 438 km at ±30 days. [Raw responses](source/reference/) are retained.

Switching to Arecibo hides the lobe labels; searching for one there selects the matching Hubble · Spitzer model.

## Known problems

- Both shapes are inferred from limited observations; neither supplies resolved terrain or a surface photograph.
- The default pole has uncertainty and an arbitrary rotation phase. The radar comparison uses an illustrative alignment.
- Equal-density origins are assumptions. Gray material is not albedo, and mesh-reduction estimates are not continuous error bounds.
- The contact point is omitted: the shared camera approach would hide it behind the nearer lobe, making its label misleading.
- The conic omits perturbations and outgassing; its ±30-day comparison is not a long-term ephemeris.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Shape selection and observational limits</summary>

The default **Hubble · Spitzer** view uses the Hubble contact-sphere model favored by [Groussin et al. (2019), A&A 632, A104](https://arxiv.org/abs/1911.04897). Its lobe proportions come from optical brightness variations; Spitzer thermal measurements constrain the overall size. This is a smooth inferred nucleus, not resolved terrain or a photograph. No coma, tail or surface markings are invented. The numerical parameters and their uncertainties are checked in under `source/shape/model.json`.

**Arecibo** is a second, separate inferred shape from [Harmon et al. (2010)](https://echo.jpl.nasa.gov/asteroids/harmon.etal.comet.tuttle.pdf), Section 3. Its prolate lobes have full dimensions 5.75 × 4.11 × 4.11 km and 4.25 × 3.27 × 3.27 km. The checked-in semiaxes divide those numbers by two; no Spitzer flux scaling is applied. Their combined length is 10.0 ± 0.9 km. The 11.385 ± 0.004 h radar period is synodic. The images had 300 m range resolution and limited aspect coverage; neither the images nor the smooth fit provide resolved global terrain.

The Arecibo axes are aligned with the default model for comparing shapes. The 2010 radar observations did not determine a unique spin pole, and this view does not apply the later candidate pole or reproduce an observed rotation phase. Each model has its own equal-density volume origin in the same metre scale; the default model supplies the common reference radius.

</details>

<details>
<summary>Size, scale, pole and coordinates</summary>

Table 3 gives the HST model two touching spheres with radii 2.8 and 1.2 km. Section 5.3 gives a thermal flux scale gamma = 0.90 ± 0.09. Since flux scales with projected area, lengths are multiplied by sqrt(gamma). The prepared radii are therefore 2.6563132345 and 1.1384199577 km, preserving the original 7:3 ratio. The paper reports uncertainties of ±0.1 km for each rounded value.

Body X joins the lobe centres; body Z is perpendicular to X and follows the model spin pole. The origin is the equal-density volume centroid, a modeling assumption, not a measured centre of mass. The reference radius 2.7242595838 km is the equivalent-volume radius of the two analytic spheres. No mass or GM is claimed.

The source pole is RA 285 ± 12°, Dec +20 ± 5°. The scene holds a fixed arbitrary rotation phase; it does not propagate the observed approximately 11.4-hour rotation period to 2026. Neither a current attitude solution nor the 2008 encounter geometry is implied.

Heliocentric placement uses JPL Horizons `DES=8P;CAP;`, centre `500@10`, ICRF, at JD 2461286.5 (3 September 2026). TDB is approximated as TT within 2 ms, following the shared astronomy convention.

</details>

<details>
<summary>Prepared geometry and material</summary>

The shared `contact-ellipsoids` loader tessellates the two lobes into 4,096 triangles in metres. It preserves separate surface normals at the contact. The two lobes are not resampled as a single radial globe or joined by an invented neck.

Meshoptimizer 1.2.0 reduces this to 1,000 native PolyCSS triangles with a 50 m error allowance. The source contact position is locked. The estimated error is 31.30 m; this is a simplifier estimate, not a Hausdorff bound or measurement uncertainty. The final topology has 503 vertices, 1,500 edges and Euler characteristic three: two closed lobes sharing one point.

The Arecibo model follows the same source-mesh route with a 75 m error allowance and its own geometry, lighting banks and thumbnail. Both sets of 1,000 leaves are prepared in one scene; only the selected set is displayed. A dataset change does not generate geometry, mount another object or move the shared camera.

A uniform #b8b6b2 material makes the geometry readable. It is an illustration, not a measured albedo. The preparation pipeline bakes source-mesh normals, directional shadows and flood lighting into fixed triangle atlases.

</details>

<details>
<summary>Credits</summary>

Credits and restoration pins remain beside the package. Source papers are cited, not relicensed as cssEarth assets.

</details>
