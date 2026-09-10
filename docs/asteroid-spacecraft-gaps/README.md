# Annefrank and Braille

This batch closes two spacecraft-target gaps: Stardust's Annefrank and Deep Space 1's Braille. Each uses the existing observation-constrained ellipsoid recipe, 480 PolyCSS native raster triangles, a normal missing-data grid, and Shadows and Orbit off by default. No resolved terrain or surface reflectance is claimed.

| Body | Full approximation dimensions | Source meaning |
| --- | --- | --- |
| Annefrank | 6.6 × 5.0 × 3.4 km | Duxbury et al. (2004) used a preliminary ellipsoid to bound minimum dimensions from limited Stardust viewing. The angular silhouette is not reproduced. |
| Braille | 2.1 × 1 × 1 km | Oberst et al. (2001), repeated in Buratti et al. (2004), combine flyby images and ground-based photometry. The equal short axes belong to that coarse estimate. |

The approximate interpretation appears beside each active view. The geometric mean of the semiaxes supplies the approximation's rendering scale; it is not an independently measured mean radius. Poles and surface longitudes are arbitrary display choices. Braille's probable 226.4 ± 1.3 h synodic period is reported as a fact and is not used as a sidereal rotation model.

Original observations:

- [Duxbury et al. (2004)](https://doi.org/10.1029/2003JE002108), especially the preliminary ellipsoid discussion in section 1; [NASA record](https://ntrs.nasa.gov/citations/20060040031).
- [Oberst et al. (2001)](https://doi.org/10.1006/icar.2001.6648); [USGS author record](https://www.usgs.gov/publications/a-model-rotation-and-shape-asteroid-9969-braille-ground-based-observations-and-images).
- [Buratti et al. (2004)](https://doi.org/10.1016/j.icarus.2003.06.002), Table 1; integrated infrared spectra establish no mapped surface texels.

## Why these two

The 2026-09-09 comparison against the [exceptional-asteroids article](https://en.wikipedia.org/wiki/List_of_exceptional_asteroids) found 14 of its 18 spacecraft-target rows registered, including Ceres. These two additions bring that membership to 16/18. This counts registered representations, not fully reconstructed terrain.

Dinkinesh and Torifune remain higher-value geometry acquisitions, with their original mesh requirements retained:

- Dinkinesh: the published revised Lucy reconstruction and archived imagery are documented in [the existing Lucy source survey](../lucy-targets/README.md#dinkinesh-source-gate). No original numerical mesh was verified in the checked release. A smooth ellipsoid would discard the defining ridge and trough.
- Torifune: the newly checked [CDS catalog J/other/Icar/459.K7229](https://cdsarc.cds.unistra.fr/ftp/J/other/Icar/459.K7229/ReadMe) is now available, but its file inventory contains only `lc.dat`: 157 photometric rows, not shape vertices. The [post-encounter JAXA report](https://www.hayabusa2.jaxa.jp/topics/20260705_flyby/) confirms contact-binary morphology. The pre-encounter convex model must not be presented as a reconstruction of that resolved form. The catalog's preliminary bibliographic identifiers differ from the final article; the title and contents were checked directly.
- 1998 KY26: the [2025 study](https://www.nature.com/articles/s41467-025-63697-4) revises its diameter and spin and offers generated datasets on request. The superseded 30 m JPL radar mesh is not relabelled or rescaled.

These dispositions are acquisition limits, not assertions that the scientific models do not exist. Annefrank and Braille have published coarse dimensions that support the existing explicitly labelled approximation, without introducing a reconstruction technique.

## Reproduction

From the repository root, with the pinned dependencies installed:

```sh
node docs/lucy-targets/author.mjs --inputs=docs/asteroid-spacecraft-gaps/inputs.json
node packages/astronomy/tools/generate-asteroids.mjs --object=annefrank --object=braille
pnpm --filter @cssearth/astronomy build
node tools/prepare-solar-geometry.mjs
pnpm build:preparation
node tools/objects/dist/operations.js acquire annefrank
node tools/objects/dist/prepare-authored.js annefrank --write
node tools/objects/dist/operations.js acquire braille
node tools/objects/dist/prepare-authored.js braille --write
node docs/lucy-targets/navigation.mjs --inputs=docs/asteroid-spacecraft-gaps/inputs.json --base=a5a34bdefa849801d092f10755cf81f6f3f23f5e --evidence=docs/asteroid-spacecraft-gaps/navigation-evidence.json
node docs/asteroid-spacecraft-gaps/refresh-transports.mjs
```

Run the body preparations one at a time. The author and navigation scripts accept this batch's input file while using their existing shared geometry, grid, marker and title implementations. Source pins, numerical constraints and source surveys live beside each body.

## Review and delivery

The prepared image release is available through the standard installer:

```sh
pnpm setup:assets --object=annefrank --object=braille
```

[Validation](VALIDATION.md) records source, topology, orbital, production, browser and clean-install results. The source constraint file and each body's `README.md` distinguish approximate dimensions, arbitrary display attitude and missing imagery.
