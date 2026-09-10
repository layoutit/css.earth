# C/2014 UN271 Bernardinelli–Bernstein

Bernardinelli–Bernstein has an exceptionally large nucleus. ALMA detected carbon monoxide escaping while the comet was still more than 16 AU from the Sun.

One **Illustrative nucleus** dataset uses Celestia's native mesh at the catalog's estimated scale. The whole surface carries the missing-imagery grid. Shadows and Orbit default off.

## Sources

| Source | What it supplies |
| --- | --- |
| [Celestia catalog](source/reference/celestia.ssc) | Identity, assigned mesh and approximate radius (68.5 km). |
| [Native mesh record](source/shape/model.json) | The original Celestia generator's exported geometry, normalization and scale. |
| [JPL elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric ICRF position at JD2461286.5, 3 September 2026 TT. |

[Selection, alternatives and assumptions](source/reference/source-record.json) explain the sources and factsheet derivations. [Credits and reuse terms](NOTICE.md) accompany the pinned inputs.

## Evidence

The 800-triangle display remains closed, uses source vertices and preserves volume within 2.5%. [Source and delivery evidence](source-evidence.json) records source/frame checks and fresh byte/hash verification of all 31 runtime assets. [Browser evidence](browser-evidence.json) records desktop and 390px mobile interaction, retained scene identity, and Solar System handoffs at DPR 1 and 2.

## Known problems

The mesh is a shared Celestia illustration, not a measured nucleus reconstruction. The catalog size is approximate. No surface imagery, measured pole, rotation period, current phase, tail or coma is represented. The fixed attitude is illustrative.

Position is fixed at the explorer's epoch; nearby conics are placement approximations, not long-term ephemerides or outgassing predictions. Horizons TDB differs from the stated TT epoch by less than 2 ms. [The mesh guide](../../../docs/celestia-meshes.md) explains the size convention and numerical limits.

<details>
<summary>Mesh conversion and preparation</summary>

The pinned native generator produces roughsphere.cms. Its output is normalized as Celestia does, uniformly scaled in metres, and reduced offline to 800 display triangles. The camera uses the volume-equivalent radius. Geometry, grid texels, optional lighting and the physical frame are prepared through the shared authored-object pipeline.

[Native conversion and reproduction](../../../tools/objects/celestia-comets/native/README.md) · [Catalog intake](../../../tools/objects/celestia-comets/README.md).

</details>
