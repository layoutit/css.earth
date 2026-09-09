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
node packages/astronomy/tools/generate-asteroids.mjs --object=aethra --object=lyyli --object=hela --object=kemi --object=taurinensis
python3 docs/mars-crossing-population/author.py
python3 docs/mars-crossing-population/register-objects.py
node docs/mars-crossing-population/integrate-context.mjs --source-only
```

Current state: source authoring only. Title/context finalization, serial bakes, delivery and browser qualification are pending. The live Centaur preview is preserved while this branch is authored.
