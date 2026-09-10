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

Source inputs and generated records are pinned in [the manifest](source/manifest.json). At revision `ea88f6feab53`, source/runtime closure, fresh runtime installation, all 11 shared browser conformance cases and DPR 1/2 DOM cleanliness passed for this body. The original [qualification](https://github.com/layoutit/cssEarth/blob/ea88f6feab538342257bda3b8bd7383126474017/docs/moons/b11-companion-catalog/README.md#qualification), [visual review](https://github.com/layoutit/cssEarth/blob/ea88f6feab538342257bda3b8bd7383126474017/docs/moons/b11-companion-catalog/VISUAL-REVIEW.md), [browser receipt](https://github.com/layoutit/cssEarth/blob/ea88f6feab538342257bda3b8bd7383126474017/docs/moons/b11-companion-catalog/evidence/browser.json) and [source restoration receipt](https://github.com/layoutit/cssEarth/blob/ea88f6feab538342257bda3b8bd7383126474017/docs/moons/b11-companion-catalog/evidence/source-restoration.json) remain at that revision.

Integration with main at `4b2078042` preserves this body's source, prepared and runtime records, the renderer, shared camera and browser navigation code byte for byte. The shared preparation change only replaces a historical evidence path in a comment. Those unchanged dependencies support reuse of the recorded body checks; the screenshots are from the original run. Historical batch reports and one-off capture/authoring scripts are linked at their original revision, following the current documentation contract.

Whole-repository qualification remains open. The original [final checks](https://github.com/layoutit/cssEarth/blob/ea88f6feab538342257bda3b8bd7383126474017/docs/moons/b11-companion-catalog/evidence/final-checks.json) record a missing local Polymele prepared package and the unchanged Phobos partition-fixture failure. Full build, assembly and all-object browser qualification are not established by these body checks.

## Known problems

Orbital placement is approximate context extrapolated from the 2008 mutual-orbit fit. Current phase and long-term three-body evolution are not measured. The archived pole is an assumed alignment with Alpha, not an independently measured moon pole. The published mesh contains areas with weak radar constraints; the original unseen-facet list is retained in source/reference. The all-over grid represents missing optical imagery, not radar coverage.

<details>
<summary>Preparation and source choices</summary>

The original PDS file is retained byte for byte. The existing source-mesh simplifier prepares 800 triangles and native PolyCSS raster leaves. The same mesh supplies the navigation image. All geometry, surface pixels, lighting and context assets are prepared offline. The displayed Shape view has no synthetic craters or albedo.

The PDS catalog landing page says 2003 observations, while the native product labels and paper identify January–March 2008; the latter control this package. The archive's rotation uncertainty columns also differ from the paper, so no uncertainty is silently taken from those columns. JPL's unnamed satellite API rows pair physical values with inconsistent inner/outer orbits; component identity follows the native mesh labels and papers.

Resolved optical imagery, mapped composition and a present spin-phase solution were not located. The published shape is the selected useful dataset. The [original orbit interpretation and limits](https://github.com/layoutit/cssEarth/blob/ea88f6feab538342257bda3b8bd7383126474017/docs/moons/b11-companion-catalog/README.md#orbit-interpretation-and-limits) retain the source epoch, frame assumptions and long-extrapolation limits.
</details>
