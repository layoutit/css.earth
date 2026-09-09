# Using and preparing 67P

Open `/comet-67p/` to inspect the Rosetta nucleus. Drag and zoom use the common application camera; **Shadows** switches baked lighting. The full source interpretation and limitations are in [SOURCE.md](../../../src/planets/comet-67p/SOURCE.md); credits are in [NOTICE.md](../../../src/planets/comet-67p/NOTICE.md).

Choose **OSIRIS mosaic** for six grayscale orange-filter observations from
August and September 2014. Disk illumination is approximately normalized before preparing the shared
lighting banks. Gray grid marks missing or rejected photograph samples; the
source mesh remains complete. The default **Shape model** lens is unchanged.

**Albedo**, **Spectral slope**, **3.2 µm absorption**, and **Modeled ice** add four VIRTIS scientific views from Aug–Sep 2014. Each has its own quantity, units and false-color legend. Gray grid includes missing measurements and ambiguous angular coverage near the neck. **Shadows off** preserves numeric palette colors. The [VIRTIS record](../../comets/67P-VIRTIS.md) documents model assumptions, approximate registration, source decoding and validation.

**Regions** colors the 26 named terrain regions. **Geology** shows mapped fractures,
cliffs, terraces and feature locations across the study's 17 regions. Lines and
dots are cartographic symbols, not measured feature sizes. Grid marks unsupported
coverage or unreliable matches between the source models. Both use the current
1,000-triangle mesh and the existing lighting controls. The [geology record](../../comets/67P-GEOLOGY.md)
documents the original SHAP7/SBMT data, coordinate registration and qualification.

With a supported Node version and dependencies installed:

```sh
pnpm setup:assets --object=comet-67p
pnpm dev
```

To acquire inputs and prepare the object:

```sh
pnpm build:preparation
node tools/objects/dist/operations.js acquire comet-67p
node tools/objects/dist/prepare-authored.js comet-67p --write
node tools/prepare-navigation.mjs
node tools/prepare-object-json.mjs
```

The authored neutral PNG and derived context PNG are checked in. Acquisition follows the current manifest and recipe to restore the original OBJ,
six selected OSIRIS GEO/quality IMG pairs, NAVCAM reference, four VIRTIS table/label pairs and interpretation documents, SHAP7 region cells, ESA SBMT feature files and guide, the SHAP5 ambiguity reference, ESO panorama and Inter font and verifies their pinned hashes. `prepared/object.json` is generated at installation/build time; the prepared geometry and runtime inventory remain versioned. No other object is synthesized as a fallback.

For a reproduction check, save the expected inventory before preparation and
compare the generated files against it.

Focused checks:

```sh
node --test tests/objects/unit/comet-67p/*.test.mjs tools/objects/terrestrial-layers/observation-mosaic.test.mjs tools/objects/terrestrial-layers/pds-scalar-map.test.mjs
pnpm test:browser <served-worktree-url> comet-67p
pnpm test:browser:conformance <served-worktree-url> comet-67p
```
