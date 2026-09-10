# Asteroid and trans-Neptunian population consolidation

This consolidates the remaining population work into one PR: ten Jupiter Trojans, four near-Earth asteroids, five Mars-crossers, and three trans-Neptunian objects. Chariklo and Bienor are already on main through PR85. The combined registry has 432 objects, including 22 additions to main `7ae81ba2d366ef20d1687a6eec51c2106be1e1b4`.

The separate PRs modified the same generated marker atlas, scene bindings, world context and minimap index. Consolidating their authored packages and regenerating those shared outputs once avoids requiring four successive conflict resolutions. The existing body recipes, geometry, image banks, shared camera and retained PolyCSS rendering are preserved. Shadows and Orbit remain off by default.

| Population | Bodies | Source and qualification records |
| --- | --- | --- |
| Jupiter Trojans | Diomedes, Ajax, Ilioneus, Pyrrhus, Eumelos, Lycomedes, Demodokus, Menelaus, Agenor, Mentor | [Trojan evidence](../trojan-population.md) |
| Near-Earth | Ivar, Toro, Cerberus, Tantalus | [Near-Earth evidence](../near-earth-population/README.md) |
| Mars-crossing | Aethra, Lyyli, Hela, Kemi, Taurinensis | [Mars-crossing evidence](../mars-crossing-population/README.md) |
| Trans-Neptunian | Arrokoth, Quaoar, Gǃkúnǁʼhòmdímà | [Trans-Neptunian evidence](../trans-neptunian/README.md) |

Latest main `e54f2aa4f696ec226793510276a7716448057c37` (PR95, 67P southern imagery) is included. Its complete comet package is retained; that merge does not change the 410-body marker baseline. Only the incoming comet's marker/page bindings needed another refresh.

## Evidence identity

The scientific inputs and previously qualified body presentations are retained from these exact heads:

- Trojans: `c149a6435626d6d1c83b1f163e6a384ee83023d3`.
- Near-Earth: `43ac8616c779b7faf56aca5de97d27656f7de5bd`.
- Trans-Neptunian: `7dfe81f820376f35429bed42828343a7bc2d8bd1`.
- Mars-crossing: `d179be5933e076d2a93d5863b467b1866941e0f4`.

Individual source comparisons, numerical checks, fresh-download receipts, DPR1/2 captures and drag reports retain their original build identities. They are not relabeled as new measurements of the combined build. The consolidation checks catalogue ownership, source and presentation preservation, all transport/page bindings, astronomy, and combined navigation. It does not repeat body raster preparation or performance traces.

## Reproduction

After building astronomy and preparation, use the existing owners:

```sh
node tools/prepare-solar-geometry.mjs
node docs/lucy-targets/navigation.mjs --base=7ae81ba2d366ef20d1687a6eec51c2106be1e1b4 --inputs=docs/non-belt-populations/inputs.json --evidence=docs/non-belt-populations/navigation-evidence.json
node docs/non-belt-populations/refresh-transports.mjs
node site/minimap/prepare.mjs
```

`navigation-evidence.json` verifies preservation of all 410 main marker tiles at both densities. The per-population source limitations still apply, including ambiguous poles, approximate thermal diameter scaling, unresolved surface imagery, schematic ring opacity and modeled/unconstrained parts of Arrokoth's albedo release.
