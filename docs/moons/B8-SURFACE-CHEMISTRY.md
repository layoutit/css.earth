# B8: Surface chemistry on Io, Ganymede and Enceladus

Owner: Moons. Accepted 2026-09-09. Branch: `feat/moons-surface-chemistry`.
Accepted base: main `2f6f8614add9a5a22ef03b86a47edef631950ade`, after merged B7 PR #81.
Integration base: `1fb76e44d6bf831e7ebcf0516b83c0b10e1716da`, including PR #82's
new asteroid marker indices. The incoming marker update is retained.
Status: five views prepared; original-source reproduction and package closure
pass; browser/delivery review in progress.

## Delivered scope

| Body | Existing controls gain | Exact quantity and limits |
| --- | --- | --- |
| Io | Spectral slope; Visible absorption | Published VLT/MUSE 477.5–495 nm normalized slope and mean continuum-removed 520–660 nm depth. Sulfur-sensitive proxies, not SO2 abundance or definitive species identification. |
| Ganymede | Oxygen signature | Published 565/577.3 nm reflectance ratio associated with molecular oxygen in surface ice. Not oxygen percentage or atmospheric density. |
| Enceladus | Ice absorption; Infrared ratio | Fixed native Cassini VIMS 2.02 µm continuum depth and near-3.1/1.66 µm ratio. Partial source-center coverage; uncorrected photometry and archive filtering are explicit. |

One complete three-moon batch uses the existing dataset controls, legends,
minimaps and scene. No renderer, shell, navigation, camera, geometry or retained
tree change. Numerical interpretation, projections, masks and textures are
prepared offline. Five views add **20 image files / 585,804 bytes**; this image
increment excludes object JSON transport and existing/shared assets.

## Qualified sources

MUSE: [King release v0.1.0](https://doi.org/10.5281/zenodo.11402374), author commit
`1e162eaeb7e52c1e263555ec1fe30e30a993a7d7`; [paper](https://doi.org/10.1029/2024JE008511).
Nine original FITS files are retained. Explicit dataset CC BY 4.0 is verified
through DataCite. Their WCS-free headers require a documented coordinate
interpretation corroborated by published landmarks and observing footprints.
Two-degree samples remain coarse; absolute subpixel registration is unresolved.
Each night remains separate. First-valid night 1→2→3 coverage retains seams and
residual calibration differences. A one-native-node edge buffer is withheld.

Enceladus: six [Nantes Cassini VIMS](https://vims.univ-nantes.fr/) C/N pairs,
5,647,058 original bytes, with [blanket CC BY 4.0 terms](https://vims.univ-nantes.fr/about).
Two numerical maps use 1,477 distinct archive-native samples within conservative
interior center cells. Estimated support is 23.77% of a reference sphere.
Local holdouts test transfer consistency, not absolute spacecraft pointing or
measured detector footprints. The result is not the unavailable Robidel corrected
global mosaic. The original figures' 180-degree longitude-label corrigendum is
preserved in the source audit; mapping uses the native navigation backplanes.

Every original and derived map is pinned beside its body. Exact units, masks,
coordinate evidence, ownership and scientific limitations are documented in
[Io](../../src/planets/io/source/muse/INTERPRETATION.md),
[Ganymede](../../src/planets/ganymede/source/muse/INTERPRETATION.md), and
[Enceladus](../../src/planets/enceladus/source/vims-chemistry/SOURCE-QUALIFICATION.md).

## Reviewed candidates carried forward

| Candidate | Disposition |
| --- | --- |
| Io Juno/JIRAM, DOI 10.5281/zenodo.3923699 | Explicit CC BY 4.0; original ENVI payloads were inaccessible through bounded CLI and browser attempts. About 22% published surface coverage, not global. No numerical map inferred from figures. |
| Ganymede SPHERE posterior, DOI 10.5281/zenodo.6390443 | Original author file and model bounds numerically qualified. Dataset reuse terms remain unresolved; the paper's CC BY license is not assigned to the dataset. Candidate converter and maps remain unpublished. |
| Ganymede JIRAM, DOI 10.6084/m9.figshare.21710468.v2 | CC BY 4.0 and table bytes verified. Released center/corner geometry, 0/1 validity and per-row rejection semantics need clarification. [Detailed disposition](b8-surface-chemistry/GANYMEDE-JIRAM-DISPOSITION.md). |
| Corrected Enceladus global VIMS releases | Exact numerical delivery for Robidel/Combe/Filacchione candidates unresolved. JPL PIA24027 is a retouched ISS/VIMS illustration; it is not a numerical source. The six-cube product has its own stated limits. |

## Qualification and reproduction

- Fifteen focused converter tests pass. Independent review found no actionable
  converter defects and retains the registration qualifications above.
- All 21 original numeric files were downloaded into an empty destination;
  all 11 derived TIFFs reproduced byte for byte.
- Independent Enceladus calculations match 94,916 supported values and 192
  source-cell containment probes per field. MUSE original-array and manifest
  checks cover every selected FITS/TIFF, night order and configured grid.
- All three package/source/runtime closures and the shared runtime ownership
  audit pass. Scene bytes and retained runtime trees match the base.
- Package, renderer and preparation builds pass. Heavy jobs run one at a time,
  with resource receipts; broader and browser gates are tracked separately.

Reproduction and capture helpers live in [b8-surface-chemistry](b8-surface-chemistry/).
B4 observation charts remain paused in draft PR #70. B8 deepens existing moons;
the frozen moon roster and benchmark denominator do not change.
