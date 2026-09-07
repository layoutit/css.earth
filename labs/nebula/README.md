# Nebula Lab

A local inspection workspace for the checked-in galaxy image layers. It uses the actual CSS renderer and retained camera controls, separate from the application shell.

From the repository root. The extraction steps create local LMC/SMC comparison candidates; omit those steps if you only want to inspect the existing prepared banks.

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula:extract src/objects/lmc/source/source.jpg .local/nebula-lab lmc
pnpm lab:nebula:extract src/objects/smc/source/source.jpg .local/nebula-lab smc
pnpm lab:nebula
```

Open <http://127.0.0.1:4331/>. A dedicated Vite configuration serves only the lab entry, with filesystem access to the repository's prepared banks. The lab has no production route or publishing step. The local source images and prepared image banks must already be present; `pnpm lab:nebula` does not acquire or bake assets.

- Choose a prepared subject, then drag to orbit and scroll or pinch to zoom.
- Inspect the whole object, diffuse component, or compact detail.
- Use Auto for normal axis selection, or isolate X, Y, or Z. Diffuse and compact-detail inspection uses Z; choosing another axis restores Whole object because the side banks combine both components. A subject without a separate detail bank disables Compact detail.
- Depth selects all layers or one prepared layer. Selecting a layer in Auto freezes the currently dominant axis so the layer remains identifiable while orbiting.
- Source image shows the available local references. Where several exist, its Image chooser switches between the wide field and a detail reference; this changes only the comparison image, not the 3D model. Source and credit follows the inspected image and returns to the model's base source in 3D view.
- Reset camera restores the subject's initial view.

The current subjects are M31, M33, LMC, SMC, and the Milky Way volume reference. The selector is populated from the viewer's subject catalogue; further prepared subjects can use the same controls. Modeled image depth is an interpretation of a two-dimensional image, not a measured reconstruction.

Extraction writes `{id}-{cutout,diffuse,residual,mask,comparison}.png` and `{id}-receipt.json` to the local output directory. The comparison panels show source, diffuse, compact residual, alpha mask, and final cutout. The Source image chooser discovers the cutout, diffuse, residual, and mask candidates. These offline experiments do not replace the prepared 3D banks or modify production assets.

`viewer.ts` owns the actual renderer and camera. `main.ts` only connects retained controls to its API. All images and geometry are prepared before inspection.
