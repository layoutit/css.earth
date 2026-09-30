# Sun

`/sun/` shows maps spanning Carrington Rotation 2311, 12 May–9 June 2026. They combine observations across one rotation, not one simultaneous view. The Sun scene also hosts the Solar System overview.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Visible surface | JSOC SDO/HMI `hmi.Ic_noLimbDark_720s`, 28 frames of CR2311 | Strips near the centre of each day’s disc form a map; JSOC removed the limb darkening. Colours and polar coverage are display choices. |
| Magnetic field | JSOC HMI `hmi.mrsynop_small_720s[2311]` | Magnetic field pointing into or out of the Sun, shown in false color. |
| Lower atmosphere | SDO AIA 304 Å CR2311 FITS | Ultraviolet light from the chromosphere and transition region, shown in false color. |
| Corona · 171 Å | SDO AIA 171 Å CR2311 FITS | Ultraviolet light from the quiet corona and upper transition region. |
| Corona · 193 Å | SDO AIA 193 Å CR2311 FITS | A different band sensitive to coronal and hot flare plasma. The arrows switch between the two corona maps. |

The Solar System overview's credits also include the planets, moons, asteroids and comets in the [shared world](source/presentation/solar-system.json). Each body keeps its imagery, measurements and full acknowledgments in its [own object package](../). The [shared orbital preparation](../../../packages/bake/cli/prepare-solar-geometry.mts) combines analytical models with retained Horizons states at the displayed scene epoch; these are not live ephemerides. The [world navigation recipe](source/navigation/universe.json) samples every prepared orbit at 90 vertices.

## Processing

- **Photosphere.** Each of the 28 frames is placed by its pinned DRMS record (CRPIX, CDELT, CROTA2, RSUN_OBS, CRLN_OBS and CRLT_OBS), and each map column blends the two frames whose central meridians bracket it. Colours follow SDO's own browse colour table, measured by registering a browse JPEG on the `hmi.Ic_720s` frame. The rim darkening plate uses the limb darkening JSOC removed. `@cssearth/fits` (`packages/fits/src/rice.ts`) decodes the Rice-compressed FITS.
- **Magnetic field.** The 720 x 360 map is equally spaced in sine latitude. Preparation resamples it to equal latitude and uses a bipolar blue-to-amber scale.
- **Ultraviolet.** The AIA maps are 3,600 × 1,080, displayed with a logarithmic intensity scale. Nonfinite samples are kept as gaps; zero and negative samples stay dark. The 193 Å display uses a brown-to-cream palette over 10–1100 counts/pixel.
- All maps are used with their stored east-positive longitude. Each surface declares its interpretation in the `science.synoptic` block of `source/preparation/raster.json`.

The emissive presentation has no lighting: no Shadows toggle, no directional Sun, no terminator. Off-limb plates are transparent; the rim plate is a display treatment, not a reconstruction of the corona.

## Evidence

![The 193 Å corona view, with its source map and wavelength arrows](evidence/aia-cr2311-20260927/corona-193-desktop.png)

- With the photosphere placed by each frame's recorded geometry, 100% of sunspot pixels fall within 1° of strong field in JSOC's magnetic map ([before, after and the magnetic field](source/reference/photosphere-before-after.png)).
- On the full 13 May frame, every one of the 16.8 million decoded samples equals astropy's raw integer.
- The [FITS map tests](../../../packages/bake/src/objects/interpretation/fits-map.test.mts) check north and south pixel centres, zero and negative values, BLANK handling and transparent off-limb plates.
- In the [four-dataset render](source/reference/rendered-lenses.png), active regions sit in the same places in every dataset.

## Known problems

- Polar silhouette dent: the shared sphere closes each pole with one flat patch at the 78.75° band boundary, so seen from the equator the disc is about 1.9% of R (≈ 6 CSS px at the default 310 px radius) short at each pole. A polar band extension of the shared geometry would remove it.
- The visible-surface and magnetic-field maps continue unobserved polar values by Fourier continuation. These filled areas are display approximations. The ultraviolet maps instead mark missing samples with the shared gray grid.
- Ultraviolet colors are display scales for detector counts, not temperature or calibrated radiance. Brightness should not be compared numerically between wavelength bands.
- Below I/I₀ 0.56 the SDO colour table is not measurable; the palette ramps linearly to black there.
- NASA's 193 Å file has an unterminated WAVELNTH string. The shared FITS reader accepts it with a warning and preserves the original card.
- The Sun has no entry in the shared solar geometry tables; its 7.25° presentation axis and world frame are authored, not derived from an ephemeris. The prepared sky is not astrometrically registered.
- The shape radius is the IAU nominal 695,700 km; the NASA fact sheet's rounded "700,000 km" stays a fact sheet value only.

## Virtual Telescope API

The [source observation declarations](source/observations.json) expose 32 native disk-map inputs through `telescope:query`: 28 HMI continuum frames, the HMI radial-field map and the AIA 171/193/304 synoptic maps, plus a COR1-A density cube.

```sh
node packages/telescope-cli/run-typed-module.mjs packages/telescope-cli/src/query.mts --target sun --wavelength 0.0170,0.0172 \
  --any-time --min-arcsec 2 --kind image --result telescope-product --json
```

These products are usable native arrays, not yet qualified shared body maps.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
