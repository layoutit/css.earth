# Centaur population

Chariklo and Bienor add two different observation-constrained Centaur shapes. Both use the established ellipsoid radius-table author, meshoptimizer, 480 native PolyCSS `u` raster triangles, and the standard missing-data grid. Shadows and Orbit default off.

## Selected scientific inputs

| Body | Shape constraints | Orientation | Source |
| --- | --- | --- | --- |
| Chariklo | Semiaxes 143.8, 135.2, 99.1 km, with asymmetric uncertainties | ICRS ring normal RA 151.03°, Dec +41.81°, assumed aligned with the body spin; sense and absolute phase unknown | [Morgado et al. 2021, Table 6](https://doi.org/10.1051/0004-6361/202141543) |
| Bienor | Semiaxes 127±5, 55±4, 45±4 km | Prograde ecliptic pole longitude 35°±8°, latitude 50°±3°; refined 9.1736±0.0002h period | [Rizos et al. 2024](https://doi.org/10.1051/0004-6361/202450833) |

These smooth models do not resolve topography. The rendered reference scale is the geometric mean of the nominal semiaxes, not a new independent radius measurement. Bienor's reference ellipsoid does not explain all photometric asymmetry; the paper's irregular-shape, albedo and satellite alternatives are not uniquely determined surfaces. Neither target has a qualified registered surface mosaic.

## Chariklo's rings

[Santos-Sanz et al., arXiv 2510.06366v1, Table 1](https://arxiv.org/html/2510.06366v1#S0.T1) gives JWST F150W2 first-contact radii and radial widths from 18 October 2022: C1R 385.9km / 7.04km, and C2R 400.3km / 1.009km. The full uncertainty and transmission fields are retained in [chariklo-rings.json](chariklo-rings.json). Using one sampled contact as a concentric circular annulus is an explicit approximation. It does not invent unobserved longitude structure.

Gray values and fixed alpha are schematic display choices. Normal occultation opacity is recorded alongside them, and is not claimed to be reflected-light brightness or a view-dependent optical model. The broad C2R uncertainties and wavelength/epoch changes are retained. The 2021 C2R equivalent width 0.117 km is opacity times width, **not its physical radial width**.

The shared terrestrial extension calls Haumea's existing annular geometry helper and the existing coplanar raster compiler. It places the resulting retained image tiles in the body carrier and preserves the transparent aperture and gap. Runtime creates no geometry or ring optics. The body stays on the established triangle path; the Haumea body renderer and illustrative NASA texture are not copied.

## Source survey dispositions

- Included: the selected global occultation/photometric constraints and normal grid. The raw papers and downloaded-source hashes are retained locally under `output/population-prs/centaurs/sources/`; published papers are cited, not relicensed or bundled into the source package.
- Included: Chariklo's two detected rings, with dimensional and optical assumptions above. Integrated JWST water-ice spectra are useful context but supply no mapped surface texels.
- Deferred: [Pholus's 2005 light-curve model](https://doi.org/10.1016/j.icarus.2004.12.011) has ratios 1.9:1:0.9, but its old 310×160×150km scale assumes albedo 0.04. [Herschel radiometry](https://www.aanda.org/articles/aa/abs/2014/04/aa22377-13/aa22377-13.html) revises its size substantially. Combining that radiometric effective diameter with the older shape as a volume constraint requires a shape/aspect-aware interpretation that has not been qualified here.
- Chiron is outside this PR because of its comet overlap. No duplicate package or invented fallback shape is introduced.

## Reproduction

Use the pinned project dependencies. Run each body serially.

```sh
node docs/lucy-targets/author.mjs --inputs=docs/centaur-population/inputs.json
node packages/astronomy/tools/generate-asteroids.mjs --object=chariklo --object=bienor
node docs/centaur-population/author-details.mjs
node docs/lucy-targets/author.mjs --inputs=docs/centaur-population/inputs.json --refresh-pins
pnpm --filter @cssearth/astronomy build
node tools/prepare-solar-geometry.mjs
pnpm build:preparation
node tools/objects/dist/operations.js acquire chariklo
node tools/objects/dist/prepare-authored.js chariklo --write
node tools/objects/dist/operations.js acquire bienor
node tools/objects/dist/prepare-authored.js bienor --write
node docs/lucy-targets/navigation.mjs --base=1fb76e44d6bf831e7ebcf0516b83c0b10e1716da --inputs=docs/centaur-population/inputs.json --evidence=docs/centaur-population/navigation-evidence.json
node docs/centaur-population/refresh-presentations.mjs
node docs/centaur-population/refresh-transports.mjs
node docs/centaur-population/integrate-context.mjs
node tools/prepare-object-json.mjs sun
node site/minimap/prepare.mjs
node docs/centaur-population/verify.mjs
```

Astronomy uses the existing JPL Horizons generator at the repository's fixed scene epoch. It does not claim current surface attitude or a real-time orbit solution. Delivery, focused source checks and remaining browser/build boundaries are recorded in [VALIDATION.md](VALIDATION.md).

Main `3badfb535` replaces individual body page wrappers with shared object and navigation routes. Both Centaur packages declare their stylesheet through the existing page contract. Transport refresh writes the corresponding prepared page metadata, and minimap preparation includes both bodies in the spatial point index. Source closure, six shape/ring checks and the focused page/router/minimap contracts pass after integration. Shape, ring and scene asset bytes are unchanged; the previously recorded browser evidence predates this main update.
