# Sun

Route: `/sun/`. Maps assembled from solar observations, with separate imagery
beyond the visible disk.

## Sources

The [source manifest](source/manifest.json) pins input files and metadata.
[NOTICE](NOTICE.md) records credits and reuse terms. The [descriptor](object.json)
and [recipes](source/preparation) specify preparation; [generated provenance](prepared/provenance.json)
connects outputs to inputs, and the [delivery inventory](runtime-assets.json)
identifies the shipped images.

### Solar maps

- Photosphere: colorized SDO/HMI continuum browse images, assembled from
  central-meridian strips across CR2311. Source-derived limb normalization and
  continuation beyond the observed polar latitudes are display approximations.
- Magnetic field: JSOC `hmi.mrsynop_small_720s[2311]`, the 720 x 360 radial
  magnetic-field map for Carrington Rotation 2311. The FITS grid is equally
  spaced in sine latitude. Preparation resamples it to equal latitude and uses
  a declared bipolar blue-to-amber false-colour scale.
- Chromosphere: NASA SDO AIA 304 Å CR2311 FITS synoptic map, 3,600 × 1,080,
  displayed in false color with a logarithmic intensity scale.
- Corona: NASA SDO AIA 171 Å CR2311 FITS synoptic map, 3,600 × 1,080,
  displayed in false color with a logarithmic intensity scale.

CR2311 covers 2026-05-12 through 2026-06-09. A synoptic map combines central
meridian observations across one solar rotation; it is a full-surface temporal
map, not a simultaneous snapshot. Preparation fills only missing AIA samples
from the nearest valid latitude in the same checked map. The browse images and FITS maps are already processed mission products.
Strip assembly, resampling, missing-sample filling and color mapping are our
additional steps; the textures are display outputs.

The pinned 2026-05-27 AIA browse images are separate, Earth-facing
observations. AIA 304 and 171 contribute prepared off-limb context only to
their matching lenses. The photosphere off-limb asset is transparent. These
plates are stationary and sit behind the globe; they are never presented as a
rotating global surface.

### Mapping the observations to the display

PolyCSS maps the prepared 1,024 × 512 global texture onto 448 HTML surface
elements arranged by longitude and latitude. Each pole adds 32 textured band
elements and one center cap, for 514 visible surface elements in total. Camera
pitch and yaw change the visible source texels, and the body animation rotates
actual global longitudes around the prepared solar axis.
Because all longitudes converge at a pole, preparation tapers each source
sample to the same-latitude longitudinal mean near the cap centre, to reduce the visible seam. This is a display treatment, not another pole observation.

Each lens also has one source-derived, antialiased 512-pixel limb asset. It
covers only the outer edge to smooth the visible corners of the surface elements;
its transparent center does not replace the globe material. At device DPR 1 and 2,
the scene uses the same highest-resolution surface, polar, limb and off-limb
images, selected once when the scene opens.

The retained cubic starfield is prepared from ESO/S. Brunier's photographic
`eso0932a` full-sky panorama at DPR 1 and DPR 2. The HYG v4.1 subset remains
the reference for checking sky coordinates. The star panorama is not tied to the solar maps’ observation epoch;
its background omits the Sun itself.

## Evidence

This README does not yet cite a dated scientific, installation or browser run.
The [unit tests](../../../tests/objects/unit/sun) and
[browser profile](../../../tests/objects/browser/sun/browser-profile.mjs) define
checks to run; they are not passing results. No such tests were rerun for this
documentation change.

## Known problems

Polar continuation, missing-sample filling and color choices affect the display.
Read their definitions before interpreting the view scientifically.
