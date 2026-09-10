# 2001 SN263 Gamma

A selectable smaller, inner moon through the shared CSS object renderer. Published radar shape of the smaller, inner moon. Fine terrain and visible-light color are unresolved; the grid marks missing imagery. The archive includes weakly observed model regions. The model assumes the primary’s spin pole for this moon. Rotational phase is illustrative.

## Sources

| Source | Used for |
| --- | --- |
| [PDS SN263 V1.0](https://sbn.psi.edu/pds/resource/shape153591.html) | Original gamma mesh, model limits, pole and rotation metadata |
| [Becker et al. (2015)](https://doi.org/10.1016/j.icarus.2014.10.048) | Body identity and physical measurements |
| [Fang et al. (2011)](https://arxiv.org/abs/1012.2154) | Mutual orbit and its uncertainties |

The source mesh has 1,148 vertices and 2,292 faces, in kilometres. Its computed equivalent-volume radius is 0.224203 km. The paper's estimated diameter is **0.43 ± 0.14 km**; the exact mesh volume is a model property, not a more precise observation. Credits and terms are in [NOTICE.md](NOTICE.md).

## Evidence

Source inputs and generated records are pinned in [the manifest](source/manifest.json). Source/runtime closure, fresh runtime installation, all 11 shared browser conformance cases and DPR 1/2 DOM cleanliness passed for this body. See the [batch qualification](../../../docs/moons/b11-companion-catalog/README.md#qualification) and [visual review](../../../docs/moons/b11-companion-catalog/VISUAL-REVIEW.md). Whole-repository qualification remains open; the PR is draft.

## Known problems

Orbital placement is approximate context extrapolated from the 2008 mutual-orbit fit. Current phase and long-term three-body evolution are not measured. The archived pole is an assumed alignment with Alpha, not an independently measured moon pole. The published mesh contains areas with weak radar constraints; the original unseen-facet list is retained in source/reference. The all-over grid represents missing optical imagery, not radar coverage.

<details>
<summary>Preparation and source choices</summary>

The original PDS file is retained byte for byte. The existing source-mesh simplifier prepares 800 triangles and native PolyCSS raster leaves. The same mesh supplies the navigation image. All geometry, surface pixels, lighting and context assets are prepared offline. The displayed Shape view has no synthetic craters or albedo.

The PDS catalog landing page says 2003 observations, while the native product labels and paper identify January–March 2008; the latter control this package. The archive's rotation uncertainty columns also differ from the paper, so no uncertainty is silently taken from those columns. JPL's unnamed satellite API rows pair physical values with inconsistent inner/outer orbits; component identity follows the native mesh labels and papers.

Resolved optical imagery, mapped composition and a present spin-phase solution were not located. The published shape is the selected useful dataset.
</details>
