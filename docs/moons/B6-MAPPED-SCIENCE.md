# B6: mapped surface science

Status: [draft PR #76](https://github.com/layoutit/cssEarth/pull/76); six views implemented, source/package/browser checks complete, runtime assets delivered. Authorized 2026-09-09.
Branch: `feat/moons-mapped-science`; base `b3a0410f742501a1a1552dea14d9a3730fce7484`.

## Accepted scope

| Body | New views | Source |
| --- | --- | --- |
| Moon | Geology; Diviner silicate-sensitive Christiansen feature | USGS Unified Geologic Map v2; Lucey et al. corrected Diviner map (2021), DOI 10.5281/zenodo.4558194 |
| Europa | Geology; Galileo NIMS infrared | USGS SIM 3513; DOI 10.17189/4sz4-5024 |
| Callisto | Galileo NIMS infrared | Registered USGS/PDS NIMS archive |
| Charon | Modeled Bond albedo | NH-P/PSA-LORRI/MVIC-5-GEOPHYS-V1.0 |

All six views are implemented from the selected published products. See the
[visual review and delivery evidence](b6-mapped-science/VISUAL-REVIEW.md) for
the exact checks and remaining repository-wide gates.
The existing visible surfaces remain the default views.

## Frozen contract

Renderer, runtime, camera, shell, navigation, shape geometry and retained DOM
architecture stay fixed. New interpretation belongs in source inputs, offline
preparation, body recipes, descriptions, legends and prepared assets. No public
charts, new panels or runtime-derived imagery. Scientific nulls remain gaps;
regional coverage never becomes an invented global map.

## Delivery

Qualify exact products, dimensions, coordinates, wavelengths/units and validity
masks; preserve pins and reproducible acquisition. Prepare and inspect small
maps before full assets. Compare independent coordinate/value anchors and
source-to-globe views. Review all six mounted lenses, seams, coverage edges and
existing lighting states. Check source/runtime closure, affected body packages,
router and registry-derived browser conformance. Record assets and retained DOM
budgets. Record any failed or incomplete checks explicitly.

## Workstation bounds

Run one substantial preparation, download, build or browser job at a time and
use single-thread numerical libraries. The B3 task-local resource monitor checks
global free memory and the owned process tree. Its thresholds are agent-selected
safeguards, not user requirements. An initial 1 GiB limit stopped renderer type
declaration generation; rerunning that ordinary build alone completed at 1.33 GB
peak sampled RSS. The isolated browser runs include both Astro and Chrome and
are not application memory measurements. Receipts retain the actual limits and
outcomes. Selected products only; no whole archive downloads. Disable automatic maintenance on every Git write with
`git -c gc.auto=0 -c maintenance.auto=false`. The sampled RSS monitor is a stop
guard, not a hard allocation limit.
