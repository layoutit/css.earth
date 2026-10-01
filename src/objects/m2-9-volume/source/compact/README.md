# Compact Twin Jet bake inputs

`emission-{0,1,2}.f32.gz` retain the three inferred RGB emissivity voxel fields, losslessly compressed before optical integration. They are not images or runtime slices.

`model.json` retains the grid, exposure, physical-display frame interpretation, source recipe, provenance and accepted output hash. The shared symmetry replayer trilinearly samples the fields and integrates the same XYZ slabs; delivery creates disposable Q80/A80 atlases afterward.

Replay requires neither the original photograph nor the iterative symmetry solver. The source photograph itself is already small (172 KB); this intermediate primarily avoids repeating reconstruction. Changing the inferred structure requires the original research pipeline and a new compact export.
