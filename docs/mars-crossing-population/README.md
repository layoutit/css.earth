# Mars-crossing population

Five Mars-crossing asteroids extend coverage beyond the main belt: Aethra, Lyyli, Hela, Kemi and Taurinensis. Every target has its own retained JPL SBDB record with class MCA, an original closed DAMIT shape mesh and a specific AKARI catalog row. The main belt remains outside this PR.

| Body | DAMIT model | AKARI effective diameter | Catalog detections | Alternative archive models |
| --- | --- | --- | --- | --- |
| Aethra | [161](https://damit.cuni.cz/projects/damit/asteroid_models/view/161) | 44.47 ± 0.74 km | 5 | 0 |
| Lyyli | [2012](https://damit.cuni.cz/projects/damit/asteroid_models/view/2012) | 27.12 ± 1.31 km | 3 | 1 |
| Hela | [454](https://damit.cuni.cz/projects/damit/asteroid_models/view/454) | 13.39 ± 0.45 km | 4 | 1 |
| Kemi | [1202](https://damit.cuni.cz/projects/damit/asteroid_models/view/1202) | 17.98 ± 1.34 km | 1 | 1 |
| Taurinensis | [490](https://damit.cuni.cz/projects/damit/asteroid_models/view/490) | 20.87 ± 0.36 km | 7 | 0 |

These are convex light-curve reconstructions. The dimensionless source meshes are transferred to the published thermal effective diameter with an explicitly approximate uniform volume scale. The quoted catalog errors describe the thermal fit; they do not include total shape, spin, thermal-model or scale-transfer uncertainty. Kemi has only one catalog detection. Competing pole solutions remain disclosed; selecting a reproducible archive model does not establish a scientific preference.

No registered surface imagery is available from these releases. The established shape-mesh preparation and normal grid are retained. The optional false-color lens shows source radius minus the reference sphere, not gravitational elevation or an independent terrain survey. Shadows and Orbit default off.

Primary sources: [DAMIT documentation](https://damit.cuni.cz/projects/damit/pages/documentation), [AKARI AcuA](https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/), [Usui et al. (2011)](https://arxiv.org/abs/1106.1948), and each retained JPL SBDB response. Unmodified meshes, spin records, publication metadata, catalog and field definitions live beside their respective body packages.

## Reproduction

Start from a clean main checkout with the pinned project dependencies and the existing Dike common source inputs acquired. Work serially. Source intake uses the retained model records, original DAMIT download URLs and unmodified AKARI catalog; `intake.py` independently checks counted topology and two volume formulas. `register-astronomy.py` registers the five identifiers, then the normal Horizons generator acquires elements and vector fixtures. `author.py` writes source packages, and `register-objects.py` adds the existing shared routes/registry entries. The title/context finalizer and later preparation remain in the standard pipeline.

```sh
python3 docs/mars-crossing-population/register-astronomy.py
node packages/astronomy/tools/generate-asteroids.mts --object=aethra --object=lyyli --object=hela --object=kemi --object=taurinensis
python3 docs/mars-crossing-population/author.py
python3 docs/mars-crossing-population/register-objects.py
node docs/mars-crossing-population/integrate-context.mts --source-only
```

After all five bakes, refresh the navigation bindings and generic page metadata using `refresh-transports.mjs`, compile the resealed Sun world context, then regenerate the shared minimap point index before the production build:

```sh
node site/minimap/prepare.mts
node --test site/test/minimap-point-range.test.mjs site/test/minimap-point-coverage.test.mjs
```

`publish.mjs` uses the existing content-addressed runtime publisher, restricted to these five bodies and one upload at a time. `fresh-install.mjs` independently downloads the published inventories with concurrency one and validates every byte count and hash.

Current state: all five source contexts and bakes are complete. Current-main navigation/page/minimap integration is complete, with 408 marker tiles preserved and five minimap tests passing. Delivery and focused numerical/package qualification also pass: 175 assets freshly downloaded and byte-verified. The ordinary production build, static transport/preload verification and focused DPR 1/2 browser qualification pass; see `VALIDATION.md`. Actual default screenshots are retained under `evidence/` with byte hashes and capture provenance.
