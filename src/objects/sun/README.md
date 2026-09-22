# Sun

`/sun/` — Maps spanning Carrington Rotation 2311, 12 May–9 June 2026.
They combine observations across one rotation, not one simultaneous view.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Photosphere | JSOC SDO/HMI `hmi.Ic_noLimbDark_720s`, 28 frames of CR2311 | Strips near the centre of each day’s disc form a map; JSOC removed the limb darkening. Colours and polar coverage are display choices. |
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

Photosphere and longitude review (this PR, measured on `main` at 11ac994699):

- The old photosphere was built from daily browse JPEGs and sampled each day's
  disc on the wrong side of its central meridian between frames. With the
  sign fixed, 100% of sunspot pixels fall within 1° of strong field in JSOC's
  own `hmi.mrsynop_small_720s[2311]` magnetic map, against 76% before; the old
  map also showed doubled, half-strength spots where two frames blended
  ([before, after and the magnetic field](source/reference/photosphere-before-after.png)).
- Longitude direction (Solar System audit, measured on `main` at 44bf8eac22):
  every Sun map was mirrored east–west. JSOC's magnetic-map header (CTYPE1
  `CRLN-CEA`, CDELT1 −0.5, pixel 1 at Carrington longitude 0.3°) and the AIA
  synoptic maps run Carrington longitude up to the right. Carrington longitude
  grows in the direction of rotation, which is the renderer's east-positive
  sense (`tools/objects/interferometry/surface-lens.mts`: east longitude grows
  from 0 at the left edge), so the maps are used as stored. The earlier review
  reversed all of them and the HMI photosphere projection laid its columns out
  from 360° down to 0°. Both are fixed; the runtime-contract test checks that
  the magnetic lens colours negative field at the left of a test map.
- The photosphere now reads 28 JSOC `hmi.Ic_noLimbDark_720s` frames (daily at
  00:00 TAI from 13 May to 9 June, plus 26 May 12:00 for the missing midnight,
  all QUALITY 0). Each frame is placed by its pinned DRMS record: CRPIX,
  CDELT, CROTA2, RSUN_OBS and the observer's CRLN_OBS and CRLT_OBS. This replaces
  the disc detection, the radial normalization and the approximate B0 formula.
  Each map column blends the two frames whose central meridians bracket it.
- The rim darkening plate uses the limb darkening JSOC removed, measured as the
  ratio of the 13 May `hmi.Ic_720s` frame to its flattened twin. The record's
  LDCoef0–5 do not follow a polynomial in 1 − μ (up to 6% off near μ = 0.2), so
  the coefficients are not used.
- Colours follow SDO's own browse colour table, measured by registering the
  13 May browse JPEG on the `hmi.Ic_720s` frame: I/I₀ = 0.56 → (249, 85, 1) up
  to 1.08 → (255, 178, 37), with a tight 10–90% spread (≤ 16 levels). Below
  0.56 sunspots are only a few JPEG pixels wide and the table is not
  measurable; the palette ramps linearly to black there.
- The JSOC segments are Rice tile-compressed FITS. `tools/fits-rice.mts`
  decodes them; on the full 13 May frame every one of the 16.8 million samples
  equals astropy's raw integer through BSCALE/BZERO, with BLANK samples in the
  same places. The [oracle table](../../../tools/oracles/README.md) lists the
  committed fixture.
- [Unit tests](../../../tests/objects/unit/sun) and the
  the shared browser conformance harness
  define the package checks. The [four-lens render](source/reference/rendered-lenses.png)
  of this version was inspected after the scene reported ready: active regions
  sit in the same places in every lens.

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

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Map dimensions and missing-sample treatment</summary>

- Photosphere: JSOC `hmi.Ic_noLimbDark_720s` continuum intensity (limb
  darkening removed by JSOC) from 28 frames across CR2311, placed by each
  frame's recorded geometry and coloured with SDO's measured browse colour
  table. Continuation beyond 80° latitude is a display approximation.
- Magnetic field: JSOC `hmi.mrsynop_small_720s[2311]`, the 720 x 360 radial
  magnetic-field map for Carrington Rotation 2311. The FITS grid is equally
  spaced in sine latitude. Preparation resamples it to equal latitude, keeps
  its east-positive longitude axis and uses a declared bipolar
  blue-to-amber false-colour scale.
- Chromosphere: NASA SDO AIA 304 Å CR2311 FITS synoptic map, 3,600 × 1,080,
  east-positive longitude as stored, displayed in false color with a
  logarithmic intensity scale.
- Corona: NASA SDO AIA 171 Å CR2311 FITS synoptic map, 3,600 × 1,080,
  east-positive longitude as stored, displayed in false color with a
  logarithmic intensity scale.

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

The continuum frames and FITS maps are processed mission products. Strip assembly,
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

## Virtual Telescope API

The [source observation declarations](source/observations.json) expose 31 existing manifest-pinned
native products through `telescope:query`: 28 HMI continuum frames, the HMI radial-field map, and
AIA 171/304 synoptic maps. No solar branch is required in the shared query or qualification code.

```sh
pnpm telescope:query --target sun --wavelength 0.0170,0.0172 \
  --any-time --min-arcsec 2 --kind image --result telescope-product --json
```

Execute a returned qualification action to acquire and decode an exact observation. The receipt
attests source integrity and decoding. HMI keyword metadata, AIA's time-dependent synoptic grid,
unknown achieved resolution and missing uncertainty remain explicit limitations. These products
are usable native arrays; they are not yet qualified shared body maps. The display maps described
above retain their existing separate preparation and provenance.
