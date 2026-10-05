# Observable Universe microwave background

What the world draws at the edge of the [Observable Universe](../observable-universe/README.md), the root of the object tree:
everything whose light has had time to reach us. That object has its own page, `/observable-universe/`. Its view
reads from 1 Gpc out, opens 52 Gpc from the Sun and reaches 80 Gpc, far enough for the microwave background's caption to
fit below it.

Inside it are DESI's galaxies and the quasars of DESI and Quaia, out to 6.6 Gpc, which the
[Nearby Universe](../nearby-universe/README.md) package draws. This package draws what lies at its edge: the cosmic
microwave background, light from 372,000 years after the Big Bang, on the sphere 14 Gpc away that it left from.

## Sources

| Source | Measurement used |
| --- | --- |
| [Planck 2018 IV](https://arxiv.org/abs/1807.06208) | The SMICA map of the cosmic microwave background (PR3, HEALPix Nside 2048), and the collaboration's style-guide color table. |
| [Planck 2018 VI](https://arxiv.org/abs/1807.06209) | The cosmology that turns a redshift into a distance (Astropy's Planck18) and the redshift of last scattering, z* = 1089.80. |

The [recipe](source/cmb/sphere.json) names the map, color table, range, radius, mesh, limb, cutaway and datasets; the
[manifest](source/manifest.json) binds the inputs to their source records. The
[investigation ledger](investigations.json) records why this map was used.

## Registry entry

This package is a context bank: it has no catalogue entry and no page. The [Observable Universe](../observable-universe/README.md)
object names it under `properties.overview.packages`, and its three datasets (off, cut open, full sphere) name this
bank's views, which [object.json](object.json) lists under `properties.views`. Its prepared file is the image mesh
(`cssearth-image-mesh@1`); the world draws every context object prepared as one.

## Processing

[`prepare-map-sphere.mts`](../../../packages/bake/cli/prepare-map-sphere.mts) draws Planck's 2018 SMICA map on the
sphere its light left from, the surface of last scattering: the comoving distance of z* = 1089.80 (Planck 2018 VI,
Table 2) in the Planck 2018 cosmology, 13,884 Mpc or 45.3 billion light-years. Its light left 372,000 years after the
Big Bang: the age of the universe at z* in the same cosmology (Astropy 8.0.1 `Planck18.age`), the figure the card
quotes.

1. The sphere is the planets' standard sphere: 16 latitude bands of 32 flat cells, ICRS north up, the top and bottom
   bands closed by round polar caps, 450 PolyCSS leaves in all, each showing its own tile of one atlas (64 texels a side
   for a cell, 192 for a cap, so a cap's texels are no coarser than the equator's).
2. Each texel averages 2 by 2 samples of the map at its direction, taken through the same projective mapping the leaf
   draws its tile with and turned from ICRS into the map's Galactic coordinates. It takes the Planck style-guide color
   for its temperature over ±300 µK, each channel raised to the power 1.6 so the table's pale middle does not glare
   beside the dots.
3. Each patch shows only its front, so from outside the far side never shows through. The sphere fades in as the camera
   leaves it, from its radius to twice that. From inside it would be the whole sky, which the app does not draw.
4. Like a body it has a limb plate, a prepared image that faces the camera and is fitted each frame to the sphere's
   outline, and its name below it in the selected body's caption. The limb is a presentation choice, not a measurement:
   nothing sees this surface from outside, so it takes the linear limb law, 1 - 0.6(1 - μ), drawn as the bodies' limb
   plates are (`limbOverlay`, over the atlas's mean color).
5. The patches of the ICRS northern hemisphere are marked for the cutaway. Nothing is removed from the data.

## Datasets

The page has three datasets, shown with the shared dataset card in its overview card and chosen with `?dataset=` on
`/observable-universe/`:

- **Off** (the default): the sphere is not drawn or loaded, so the page opens on the galaxies and quasars alone. Its
  picture is empty and it has no legend.
- **Cut open** (`?dataset=cutaway`): the northern half is left out of the drawing so the galaxies and quasars inside show. The
  inside of the far wall is drawn at 55% opacity, behind the dots, and the rest of the shell at 85%.
- **Full sphere** (`?dataset=full`): the closed shell, which hides everything inside it.

The opening and both opacities are presentation choices, recorded in the recipe's `cutaway`. The bake writes the cards
to `prepared/datasets.json`, with the color table's legend at nine stops from −300 to +300 µK and a picture of each
view: the sphere from far away along a line 30° above the ICRS equator at right ascension 0h, north up, composed as
the page draws it from the same map, limb law and opacities
([`map-sphere-preview.ts`](../../../packages/bake/src/raster/map-sphere-preview.ts)).

## Tests and evidence

- Captures of this version show the default, cut-open view
  with its dataset card, and the full sphere after choosing it in place, at the
  same camera. An earlier capture, from before the cutaway, shows
  the whole sphere from outside seamless across its 450 patches.
- The registry tests check that the object tree is whole and that zooming out from the Sun walks the objects it is
  inside in their order (`site/test/navigation-ontology.test.mts`, `site/test/zoom-scope.test.mts`).
- The [context lineage test](../../../site/journeys/context-lineage.test.mts) checks that its products read only its source records.

## Known problems

- Texels are about 10.5 arcminutes at the equator, coarser than the map's 5 arcminute beam.
- The whole sky is drawn, including the 15.8% outside the map's own temperature confidence mask (TMASK), where Milky Way
  foreground remains.
- With the sphere cut open, the limb plate still darkens the edge of the opening.
