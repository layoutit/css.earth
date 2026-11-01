# Large Magellanic Cloud (LMC)

The site uses the owner-approved **l36 optical model**. The [recipe](source/preparation/l36/recipe.json) and [fit](source/preparation/l36/fit.json) hold its global values. Delivery does not refit its physical structure or appearance.

The model combines measured stellar populations, finite catalogue objects and dust on the published warped disc. Horálek's photograph calibrates component colors, object brightness and the approved dust material. It does not become a diffuse sheet of light in the volume. Individual catalogue objects retain their approved on-sky footprints and finite depths.

## Sources

| Component | Source and use |
| --- | --- |
| Distance and frame | Pietrzyński's 49.59 kpc distance, Choi's disc plane, Oden's distance surface and Rathore's bar placement. |
| Old disc and bar light | Gaia DR3 red giant and red clump populations, with the accepted crowding correction. Kacharov and Rathore remain structural checks. Measured Gaia photometry supplies stellar grain; the accepted population grade supplies integrated color. |
| Young stars | Gaia DR3 young members, MCPS hot stars and Bica associations. The accepted density structure and smoothing are retained; SMASH is a check. |
| Finite objects | The catalogue regions, clusters, shells and molecular clouds, with approved object footprints. Knots have depth comparable to sky width. |
| Dust | HERITAGE fine structure, Bell's large-scale column calibration and OGLE regional foreground fractions. Chen's published mean foreground reddening is retained; its unavailable regional maps are not treated as downloaded data. The accepted dust material and strength remain fixed. |
| Appearance | [Horálek optical](https://noirlab.edu/public/images/iotw2547a/) is the Earth-view calibration image. VISTA and WISE remain source checks; this model has no calibrated infrared emissivity. |

The adopted Gaussian thicknesses remain 410 pc for the old disc, 367 pc for the bar, 150 pc for diffuse young stars and gas, and 250 pc for dust. These are model assumptions and published-model choices, not precise depths recovered from the photograph. The [source manifest](source/manifest.json) owns input identities, credits and acquisition routes.

## Preparation and delivery

[`bake.mts`](../../../packages/bake/authoring/lmc-volume/bake.mts) is the one bake path. It reads the restored model and writes `prepared/`:

1. **Model.** The 534 MB of arrays under `source/model/` hold the catalogue primitives, dust clouds, Gaia stars and population fields, restored from the source mirror by `restore-source-inputs`. The [recipe](source/preparation/l36/recipe.json), [fit](source/preparation/l36/fit.json) and [slab encoding](source/preparation/l36/slab-encoding.json) hold the accepted global values.
2. **Near slabs.** Each dataset gets 26 physical slabs, distributed 10/9/7 over the axes, plus seven second optical layers: **33 layers** in all. Rays step 15 pc and finite objects are sampled at 4 by 4 subpixels. Slabs are rendered without catalogue gas or discrete dust clouds, which move to dots. They use the coarser population grids the model was fitted on: 39 pc for old stars and 19.5 pc for young.
3. **Slab delivery.** Each image is rendered at 2,054 px and ships at half that, 1,027 px across 20 kpc (19.5 pc per texel), in a box a third of its width and scaled back up. [Phone measurements](../../../packages/bake/authoring/lmc-volume/datasets/slab-delivery.mts) set this form.
4. **Far pictures.** Eight 3,072 px model pictures (9.31 pc per texel at the disc centre) on 9.77 pc population grids, including the Sun direction, face-on, 45 degrees and edge-on. Pictures alone carry projected diameters below 128 px and slabs alone carry diameters above 256 px, with a blend between. The universe backing is the face-on picture laid in the disc plane.
5. **Dots.** 354 lit gas regions become 300 billboards, and the discrete dust clouds become 139 flat patches. Each dataset's dots share one grouped layer. Their [gains](source/preparation/l36/gas-dot-gains.json) were measured once against the slab delivery the gas came from.
6. **Install.** The last stage writes the three-dataset bank and the object text and inventories. A rerun from the same inputs reproduces the published files byte for byte.

The full bake takes about 20 minutes for the slabs and 80 for the far pictures, on six workers of an M5 Pro. Run one stage on a small slice first (`slabs horalek --planes=22`).

## Reproducing the model

The bake starts from the accepted model, not from the catalogues. The arrays in `source/model/` are the output of the owner-reviewed fitting rounds, with no origin to download them from. Those rounds and their code are in Git history up to this object's approved commit. The [source manifest](source/manifest.json) lists each array with the catalogue it came from and says it is restored only from the source mirror.

The DECam and VISTA [grades](source/preparation/l36/image-grades.json) are recorded fits in the same way: the bake reads them and does not refit them.

## Validation

- A rebake from the restored model reproduces every published file of this object and of `lmc`, and the two inventories, byte for byte.
- Slab and far-picture tests hold the interval, strip and shortcut rules: a slab holds only its own interval, strips join to the whole plane, and the far-picture shortcuts change no pixel of a finite nebula.
- Earlier comparisons against the physical reference measured the first slab form, not the shipped gas-free, half-resolution one. They are in Git history and are not claimed here.

## Performance

Measured with jankmonster on the final build. The result is plain: desktop is clean in ordinary motion, phones are not.

- **Desktop**, headless on a MacBook Pro M5 Pro at 60 Hz: 0 dropped frames in 12 traces. Worst frames were 50 to 53 ms on a tilt, 22 ms on a flick, 133 to 135 ms zooming in and 119 to 121 ms zooming out. A stronger zoom out that crosses the scene handover dropped 6 to 7 frames from a 69 ms task.
- **Phone**, Galaxy S23 Ultra: grouped dots, smaller boxes and half-resolution slabs fixed tile memory and flicker. A flick last measured 42, 40 and 26 dropped frames, on a variant that was later removed, and was not traced again on the final build. **Phones are not frame-clean.**

## Datasets

Three datasets show one model. Horálek · optical is the calibration image: a [photograph by Petr Horálek](https://noirlab.edu/public/images/iotw2547a/), made with a wide-aperture telephoto lens on a commercial camera, about four hours over three nights on Cerro Pachón, Chile. Its colors are a display choice, not calibrated measurements, and no camera or lens model or filters are published. DECam · optical ([noirlab2030a](https://noirlab.edu/public/images/noirlab2030a/), CTIO/NOIRLab/NSF/AURA/SMASH, CC BY 4.0) and VISTA · near infrared ([eso1914a](https://www.eso.org/public/images/eso1914a/), ESO/VMC Survey) are graded to their images with one gain per component and one global tint; they are not reconstructed from them. 68 of the 354 lit gas regions lie outside the DECam frame and 3 outside the VISTA frame; they take the same global colors. Far pictures carry only a global color gain.

## Known problems

- Phones are not frame-clean, and the final build has no phone flick trace.
- Scalar RGBA slabs approximate spectral extinction, display grading after integration and emitter positions inside thick intervals. Absolute light, radial-profile and color limits are not all met, and the shipped form has no absolute photometric measurement.
- Near slabs use coarser population grids than the far pictures, so the two differ slightly in fine structure at the handover.
- Gas as billboards has no depth inside a billboard. A billboard's share of a region is flat, and its gain is one value per owner.
- A far picture is exact, to its recorded 8-bit encoding, at its prepared direction and 49.59 kpc camera distance. Angular interpolation and other far distances approximate changes in depth projection. DECam and VISTA far pictures carry only a global color gain.
- The optical photograph constrains one direction. Unobserved depth remains conditional on the adopted disc, warp, bar and finite-object geometry. Catalogue and Hα coverage limitations remain those of the approved model.
- The model cannot be rebuilt from its catalogues by this bake; see [Reproducing the model](#reproducing-the-model).
