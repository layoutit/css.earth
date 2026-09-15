# Sun

`/sun/` — Maps spanning Carrington Rotation 2311, 12 May–9 June 2026.
They combine observations across one rotation, not one simultaneous view.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Photosphere | SDO/HMI continuum browse images | Successive strips from the center of the Sun’s disk form a map; color, brightness and polar coverage are adjusted. |
| Magnetic field | JSOC HMI, CR2311 | Magnetic field pointing into or out of the Sun, shown in false color. |
| Chromosphere | SDO AIA 304 Å CR2311 FITS | Logarithmic intensity in false color. |
| Corona | SDO AIA 171 Å CR2311 FITS | Logarithmic intensity in false color. |
| Outside the disk | AIA browse images, 27 May 2026 | Separate stationary images behind the matching globe view; not rotating global maps. |

### Solar System overview

The Solar System overview is hosted by the Sun scene. Its credits also include
the planets, moons, asteroids and comets in the [shared world](source/presentation/solar-system.json),
not just the solar maps above. Each body keeps its imagery, shape, measurements
and full acknowledgments in its [own object package](../).

The [shared orbital preparation](../../../tools/prepare-solar-geometry.mts)
combines analytical models with retained Horizons states. These prepared
positions and orbit paths use the displayed scene epoch; they are not live
ephemerides. The footer's provider list combines the existing prepared source
credits of the bodies in this overview.

## Evidence

Lane change (this PR): the static-surface lane was retired; the Sun now prepares
through the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto.
The same pinned inputs and the same numerical interpretation (continuum strip
mosaic with limb normalization, HMI and AIA FITS decoding and colour transforms,
polar-boundary continuation, off-limb registration and limb plates) moved from
`tools/objects/static-surface/synoptic-emission.mts` into the shared observation
adapter (`tools/objects/observation/solar-synoptic.mts`) without numerical changes.
Verified with the package, source-closure, minimap and browser conformance checks
listed in the pull request. No new scientific review is claimed.

Three prepared products differ from the retired lane and were inspected, not
re-derived from science: each pole closes with the shared lane's single flat
cap instead of the retired 32-segment band ring (see Known problems), the polar
cap no longer blends a blurred low-latitude proxy texture into the continuation
(the cap shows the Fourier continuation of the measured boundary only), and the
lens thumbnails crop the central half-height square of the map instead of the
central full-height square.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js sun --write`
prepared the package through the shared raster lane, the `emissive` presentation
and the star-centred scene; `node --test tests/objects/unit/sun/*.test.mts` passes
except the shared runtime-package and import-closure tests that fail identically on
`main` (recorded once in the pull request). A headless Chrome probe
(`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server and
selected the photosphere, magnetic, chromosphere and corona lenses with no console
errors or failed requests; the captures show the limb-darkened continuum disc, the
off-limb 171 Å context behind the sphere and the band step at the polar cap listed
under Known problems. [Unit tests](../../../tests/objects/unit/sun) and the
[browser profile](../../../tests/objects/browser/sun/browser-profile.mts) define the
checks; no dated scientific review is cited for this version.

## Known problems

- Polar silhouette dent: the shared sphere closes each pole with one flat
  patch at the 78.75° band boundary (z = R·sin 78.75° + offset ≈ 0.981 R), so
  seen from the equator the disc is about 1.9% of R (≈ 6 CSS px at the default
  310 px radius) short at each pole. The retired lane hid this behind 32 band
  leaves up to 89° plus a centre cap; the limb plate's rim alpha (≤ 0.68 for
  the FITS lenses, ≤ 0.36 for the continuum) does not cover it. A polar band
  extension of the shared geometry would remove it.
- Unobserved poles and missing samples are continued from nearby values.
- These filled areas and color choices must not be read as additional observations.
- The Sun has no entry in the shared solar geometry tables; its presentation
  axis (7.25° tilt) and world frame are authored in
  `source/presentation/solar-system.json` and `source/navigation/universe.json`,
  not derived from an ephemeris. The prepared sky keeps the retired lane's
  visual baseline registration; it is not astrometrically registered.
- The shape radius is the IAU nominal 695,700 km (the world frame's
  `bodyRadiusM`); the NASA fact sheet's rounded "700,000 km" stays a fact
  sheet value only.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Map dimensions and missing-sample treatment</summary>

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

CR2311 covers 2026-05-12 through 2026-06-09. A synoptic map combines central meridian
observations across one solar rotation; it is a full-surface temporal map, not a simultaneous
snapshot. Preparation fills only missing AIA samples from the nearest valid latitude in the
same checked map.

Each surface declares its interpretation in the `science.synoptic` block of
`source/preparation/raster.json`; the shared observation adapter decodes the
source values and applies the colour transform before the raster lane packs the
latitude bands, projects the poles and encodes the textures at both prepared
densities. The legends in `source/content/object.json` name the same palette stops
as the raster recipe.

The browse images and FITS maps are already processed mission products. Strip assembly,
resampling, missing-sample filling and color mapping are our additional steps; the textures are
display outputs.

The pinned 2026-05-27 AIA browse images are separate, Earth-facing observations. AIA 304 and
171 contribute prepared off-limb context only to their matching lenses. The photosphere
off-limb asset is transparent.

These plates are stationary and sit behind the globe; they are never presented as a rotating
global surface.

</details>

<details>
<summary>Globe projection, limb smoothing and sky source</summary>

PolyCSS maps the prepared 1,024 × 512 global texture onto 448 HTML surface elements arranged by
longitude and latitude, the shared raster-lane sphere. Each pole adds one flat cap element textured
from the 512 × 256 polar sprite, for 450 visible surface elements in total. Camera pitch and yaw
change the visible source texels, and the body animation rotates actual global longitudes around
the authored solar axis.

Because all longitudes converge at a pole, preparation replaces the rows inside one latitude
band of each pole with the Fourier continuation of the band boundary before packing. This is a
display treatment, not another pole observation.

Each lens also has one source-derived, antialiased 512-pixel limb asset. It covers only the
outer edge to smooth the visible corners of the surface elements; its transparent center does
not replace the globe material. The emissive presentation has no lighting track: no Shadows
toggle, no directional Sun, no terminator. At device DPR 1 and 2, the scene uses the same
highest-resolution surface, polar, limb and off-limb images, selected once when the scene
opens.

</details>
