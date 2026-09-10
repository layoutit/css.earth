# B10 — the Moon at night

[Draft PR #97](https://github.com/layoutit/cssEarth/pull/97): implemented and published; aggregate readiness limits are recorded in the visual review.

Three source-backed lunar surfaces: fitted midnight bolometric temperature,
observed-minus-modeled temperature anomalies, and updated rock-area fraction.
The accepted Moon scene, retained tree, camera, renderer, navigation and shared
shell remain fixed. PR #96's final delivery/evidence commit is carried here
because that commit landed on its branch after the merge.

Source selection and interpretation are recorded in
[source review](source-review/INDEPENDENT-SCIENCE-REVIEW.md). The PDS float32
mosaics were selected over the compressed author JP2 files to preserve subtle
rock fractions. Author TIFFs do not reduce the acquisition size. Older GDR L3
rock maps cover a smaller latitude interval and fewer observations; GCP diurnal
maps are much coarser and answer a different local-time question. Polar seasonal
products would require a separate interpretation and are not spliced into these
midnight mosaics.

The compact source grids use nearest native samples in a 4096×2048 global
angular grid. Original NaNs and rejected physical rock fractions remain missing.
The two polar caps remain unavailable. Values are packed to signed integers with
explicit scale/offset, at most 0.005 K or 0.00001 rock-area fraction quantization
error. This display grid is not the instrument's native resolving power.

The shared material preparer accepts a per-lens raster scale for oriented bands;
this increases material detail without changing the geometry or the independent
canonical-DPR policy. Minimap dimensions follow that same scale. Raw source
acquisition and verification stream their hashes into atomic files so the 3.3 GB
originals never require whole-file memory allocation.

## Reproduction

Use the repository's normal Node and the scientific Python dependencies in
`tools/objects/acquisition/requirements-mapped-science.txt`. Run one job at a time,
with `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1`. Source archives are ignored by
Git and restored from their exact PDS URL/hash pins; compact numeric TIFFs,
labels, recipes and receipts are checked in.

```
node tools/objects/dist/operations.js acquire moon
python tools/objects/acquisition/diviner-ghrm.py src/planets/moon/source/science/diviner-ghrm/prepare-tbol_m.json
python tools/objects/acquisition/diviner-ghrm.py src/planets/moon/source/science/diviner-ghrm/prepare-tbol_anom.json
python tools/objects/acquisition/diviner-ghrm.py src/planets/moon/source/science/diviner-ghrm/prepare-ra_sam.json
node docs/moons/b10-lunar-thermal/configure.mts
node docs/moons/b10-lunar-thermal/prepare-selected.mts
node docs/moons/b10-lunar-thermal/finalize-one.mts moon
```

Each numeric conversion accepts `--source-directory` and `--output-directory`
for a clean offline reproduction from original pins. Existing unrelated lunar
rasters and the frozen accepted scene must be present for the incremental
material replay. The regular static-body preparer also understands the authored
raster recipes.

Qualification and visual review are recorded in [VISUAL-REVIEW.md](VISUAL-REVIEW.md). Source correctness, browser appearance, runtime closure and remote installation are separate checks.
