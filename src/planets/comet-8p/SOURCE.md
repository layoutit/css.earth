# Tuttle: source and interpretation

The single **Inferred shape** view uses the Hubble contact-sphere model favored
by [Groussin et al. (2019), A&A 632, A104](https://arxiv.org/abs/1911.04897).
Its lobe proportions come from optical brightness variations; Spitzer thermal
measurements constrain the overall size. This is a smooth inferred nucleus,
not resolved terrain or a photograph. No coma, tail or surface markings are
invented. The selected numerical parameters and their uncertainties are checked
in under `source/shape/model.json` and pinned in `source/manifest.json`.

## Size and coordinates

Table 3 gives the HST model two touching spheres with radii 2.8 and 1.2 km.
Section 5.3 gives a thermal flux scale gamma = 0.90 ± 0.09. Since flux scales
with projected area, lengths are multiplied by **sqrt(gamma)**. The prepared
radii are therefore 2.6563132345 and 1.1384199577 km, preserving the original
7:3 ratio. The factsheet uses the paper's rounded final values, 2.7 ± 0.1 and
1.1 ± 0.1 km. Using those rounded values to build the mesh would change its
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

A uniform #b8b6b2 material makes the geometry readable. It is an illustration,
not a measured albedo. The existing preparation pipeline bakes source-mesh
normals, directional shadows and flood lighting into fixed triangle atlases.
Navigation context is rendered from the same reduced geometry and material.
The browser consumes prepared data through the shared retained-DOM scene.

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

## Source survey

| Candidate | Disposition |
| --- | --- |
| [Groussin et al. (2019)](https://arxiv.org/abs/1911.04897), Table 3 and Section 5.3 | Included: HST contact-sphere proportions, Spitzer scale, pole and uncertainty. The thermal light curve favors this family. Numerical parameters are transcribed with attribution; the paper is not redistributed. |
| [Harmon et al. (2010), Arecibo radar observations](https://echo.jpl.nasa.gov/asteroids/harmon.etal.comet.tuttle.pdf) | Credible alternative: two prolate spheroids with semiaxes (2.88, 2.06, 2.06) and (2.13, 1.64, 1.64) km. Retained separately in `reference/model-alternatives.json`; not blended into the selected HST model. The later candidate radar pole in Groussin et al. is not presented as a unique pole measured by the 2010 paper. |
| [JPL radar shape-model index](https://echo.jpl.nasa.gov/asteroids/shapes/shapes.html) | No downloadable Tuttle mesh was listed during intake. The published parametric families remain usable without inventing a measured terrain mesh. |
| Spitzer MIPS/IRS images and spectra in Groussin et al.; referenced thermal/coma studies | Useful size, thermal and coma observations, but unresolved nucleus measurements do not supply a registered surface texture. No additional surface lens is qualified. |

Background imagery is ESO/S. Brunier under CC BY 4.0; the shared title font is
Inter by Rasmus Andersson under SIL OFL 1.1. Credits and restoration pins remain
beside the package. Source papers are cited, not relicensed as cssEarth assets.
