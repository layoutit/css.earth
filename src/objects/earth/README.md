# Earth

`/earth/` shows archival imagery and scientific maps. Layers have different dates, and clouds are not live
weather. Dataset selection is manual at every zoom.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).
The [navigation marker recipe](source/preparation/navigation.json) supplies the small menu and search icons.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Surface and clouds | NASA Blue Marble, July 2004 surface plus archival cloud TIFF | Brightness is adjusted for display. Surface and clouds are separate observations. Deep ocean is shaded from depth, not observed water colour. |
| Elevation | [GEBCO_2026](https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa) | Sampled modeled height relative to sea level. Relief shading is exaggerated; globe geometry is unchanged. |
| Night lights | [NASA VJ146A4.002](https://doi.org/10.5067/VIIRS/VJ146A4.002), 2025, via Jurij Stare | Annual radiance in logarithmic false color. Gaps and aurora remain; this is not ground-level sky darkness. |
| Limb | [DSCOVR EPIC](https://epic.gsfc.nasa.gov/about) Level 1B frames, Minnaert law fitted here | Measured: Earth's brightness toward the edge in 680, 551 and 443 nm |
| Atmosphere and charts | Authored atmosphere parameter record; NASA Planetary Spectrum Generator (PSG) | Simulated atmosphere, spectrum and temperature/pressure charts. Atmosphere brightness is adjusted for display. |
| Interior | NASA schematic layers; [GLAD-M35 r0.1](https://doi.org/10.1093/gji/ggae270) | Modeled seismic wave speeds above or below the mean at each depth, not temperature. Crust and core are schematic. |
| ENSO | [NASA MUR v4.1](https://doi.org/10.5067/GHGMR-4FJ04), 7 September 2026, via GIBS | Sea-surface temperature anomaly imagery relative to 2003–2014; published color bins, not a raw numerical field. |

City search runs on the GeoNames places catalogue in [source/places](source/places/) (see
[City coordinates](#city-coordinates)). Map names come from Natural Earth 1:10m vectors (public domain) under
`source/features/`, since Earth has no IAU nomenclature, plus a short landmark list transcribed from Wikidata (CC0).
Their names, ranks and geometry are their editors' choices, not an official gazetteer.

## Processing

The July mosaic gets a display-only midtone lift, `round(255 * (value / 255) ** (1 / 1.25))`, with black and white
unchanged. This is not radiometric calibration. The 21,600 × 10,800 July grid and the 8,192 × 4,096 cloud TIFF are
sampled separately at each page coordinate.

Stöckli et al. (2005), section 2.4, state that deep ocean in the plain edition is an arbitrary reflectance, one code
value, `(2, 5, 20)`. Wherever every channel is within two code values of it, preparation takes the ocean from the
topography and bathymetry edition of the same month. That covers 64.4396% of the sphere. Shallow and coastal water is
real MODIS observation and stays. The blend runs over 40 source pixels, about 74 km at the equator.

Each view's surface is 112 square pages, each a 45° block. A view decodes only the blocks it shows, and a page takes a
sharper level only while its faces may be seen. The finest level is about 2.2 km per texel at the equator. The camera
stops where one CSS pixel shows the smallest arc the imagery supports, 3.83 × 10⁻⁴ radians. Elevation, sampled at
8,640 across, stops at the 4,096 level and zoom limit 4; the other surface views reach zoom limit 8.

The globe is lit with Earth's measured limb law
([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)), fitted to DSCOVR EPIC, the one
camera that sees the whole sunlit Earth at nearly full phase. The model atmosphere is composited over and around that
disc in one image. Night lights take no lighting or halo, since city light is emitted.

By default only oceans, continents, countries, capitals, cities, landmarks and eight highlights label the map
([features recipe](source/preparation/features.json)). Other names are searchable and label the map while selected.

## Evidence

- **Limb law.** `packages/bake/cli/fit-epic-limb.mts` fits six DSCOVR EPIC frames from 2023: Minnaert k 0.394 at
  680 nm, 0.428 at 551 nm and 0.410 at 443 nm, with frame-to-frame spreads of 0.07, 0.04 and 0.03. Below 0.5 the
  edge is brighter than the centre under full light, from atmosphere and clouds seen at a slant.
- **Scientific maps.** Numeric height checks, six independent tomography anchors, geographic registration and
  [MUR native pixel checks](../../../src/objects/earth/fixtures/mur-native-witnesses.json).
- **Named features.** 5,467 names, of which 456 label the map by default.
- **Close zoom.** The camera reaches 2,719 km above Buenos Aires, where the finest level resolves the Paraná delta's
  channels.

## Known problems

- Close zoom, observed 12 September 2026: wheel input reaching 4× zoom kept the clear surface on 512-pixel pages and
  showed missing tiles over Asia in a local Chromium run. The cause is not established.
- The limb law is a Minnaert fit to whole-disc EPIC frames, clouds included. Bins scatter 18–50% about it because
  clouds move. It applies to every dataset, including the cloud-free map.
- The EPIC law already includes the atmosphere over the disc, so the model atmosphere counts that haze twice near the
  limb. It stays until a NASA PSG limb profile replaces it (the `limb-halo` ledger entry).
- Night-light coverage stops at 75° N and 65° S. The mirror lacks quality bands, so aurora and transient lights
  cannot be filtered.
- ENSO uses NASA's display colors and clipped anomaly range. Land, ice and unavailable imagery remain gaps; RGB is not
  turned back into temperature.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Imagery and maps</summary>

Blue Marble Next Generation, July 2004, was chosen over December for clearer northern land. Only the ocean of the
bathymetry edition is used; its land carries baked relief shading.

[GEBCO_2026](https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid) is a terrain model of
measured and estimated depths, land-and-ice-surface version. Every tenth native cell is sampled, 8,640 × 4,320 at 2.5
arc-minutes: an overview, not a full-resolution DEM. The palette spans −10,000 to +10,000 m. Relief shading uses 4×
slope exaggeration and northwest light at 45°.

Night lights come through the [public mirror](https://www.lightpollutionmap.info/help.html) by Jurij Stare, the
`AllAngle_Composite_Snow_Free` band, 86,400 × 33,600 Float32 cells at 15 arc-seconds. A display cell with less than half
its area observed is gray. The logarithmic transfer saturates at 100 nW/cm²/sr.

ENSO uses 3,200 GIBS tiles recorded in the [receipt](source/science/mur-gibs-receipt.json), sampled to
16,384 × 8,192. The [NASA color table](source/science/mur-gibs-colormap.xml) has 0.1 °C bins and saturates at ±3 °C.

</details>

<details>
<summary>Atmosphere and charts</summary>

`source/atmosphere/model.json` holds the atmosphere values, adapted from OpenSpace and Bruneton and Neyret (2008):
6,377 km planet radius, 70 km atmosphere height, 8 km Rayleigh scale height, Rayleigh and Mie terms. Google Earth Pro
supplies only the presentation operator (exposure, tone mapping and opacity).
The charts come from the PSG configuration `source/atmosphere/psg-earth-20260830.cfg` (0.35–1.0 µm, R=120) and its
response `source/atmosphere/psg-earth-r120-rif.txt`, drawn as static SVG.

</details>

<details>
<summary>Interior and mantle tomography</summary>

The schematic layers follow NASA's [Earth facts](https://science.nasa.gov/earth/facts/), with the outer core and
mantle fitted to a 6,378 km radius.

The tomography view samples
[GLAD-M35](https://data.earthscope.org/app/products/portal/emc_model_viewer.html?id=EMC-GLAD-M35), a seismic inverse
model by Cui et al. from EarthScope EMC, using `vsv`, vertically polarized shear-wave velocity. Colour is
`100 * (Vsv / horizontalMeanVsv(depth) - 1)`, saturating at ±3%. The reference is not STW105, the inversion's own.
[SEMUCB-WM1](https://ds.iris.edu/ds/products/emc-semucb-wm1/) was considered; the view uses one model without
blending. A 520,307-byte subset is checked in. To rebuild it, install `numpy==2.3.5` and `h5py==3.14.0`, download the
URL in `tomography.json`, then:

```sh
python packages/bake/src/objects/layers/paged-ellipsoid/extract-tomography.py \
  /path/to/GLAD-M35.r0.1-n4c.nc \
  src/objects/earth/source/interior/tomography.json \
  src/objects/earth/source/interior/glad-m35-vsv-subset.f32.gz
node site/build/prepare/prepare-authored.ts earth --write
```

</details>

<a id="city-coordinates"></a>

#### City coordinates

`source/places/` holds the GeoNames cities15000 snapshot, acquired September 4, 2026: 34,135 places above 15,000
people or capitals. GeoNames data is CC BY 4.0 and is attributed in the search UI. Every place opens as an overview of
the globe; there is no city-level imagery.

The [Moon record](source/moon/earth-moon.json) keeps the JPL values Earth's information panel uses. The Moon is a
separate object package.
