# Milky Way: fitted starlight, dust and catalogue stars

The outside view is the accepted **b30-native-scatterFaceSide** fitted model, drawn as local slabs on three axes: 13 across each in-plane axis (X, Y) and 7 across the thin axis (Z), each slab image holding its three optical copies. It is a model, not a photograph of our galaxy from outside. Inside, one prepared sky 20,000 light-years out on the Sun's approach takes over from the far slabs; NASA's measured Milky Way map supplies the Solar System sky. Catalogue dots appear only inside the prepared stellar disc. Navigation labels remain available outside it.

## Sources

| Input | Published source and meaning |
| --- | --- |
| Accepted pre-slice fields and radiance | [Recipe](source/preparation/b30/recipe.json), [fitted parameters](source/preparation/b30/fit.json) and [lineage](source/preparation/b30/lineage.json). These preserve a local fit to the following measurements and model priors; the fit is not a published simulation. |
| Local extinction | Edenhofer et al. (2024), [dataset v1.0.2](https://zenodo.org/records/10658339), `mean_and_std_xyz.fits`; inferred extinction within 1.25 kpc. |
| Regional extinction | Vergely, Lallement & Cox (2022), [CDS J/A+A/664/A174](https://cdsarc.cds.unistra.fr/ftp/J/A+A/664/A174/ReadMe), 50 pc cube; inferred extinction density. |
| Inner extinction | Marshall et al. (2006), [CDS J/A+A/453/635](https://cdsarc.cds.unistra.fr/ftp/J/A+A/453/635/ReadMe), Table 1; extinction inferred using 2MASS and a stellar population model. |
| Far extinction | Drimmel, Cabrera-Lavers & López-Corredoira (2003), [grids, release v1](https://zenodo.org/records/7340108); a Galactic extinction model. |
| Stellar structure | [Bland-Hawthorn & Gerhard (2016)](https://arxiv.org/abs/1602.07702), thin/thick-disc priors; [Sormani et al. (2022)](https://arxiv.org/abs/2204.13114), bar/bulge model; [Reid et al. (2019)](https://arxiv.org/abs/1910.03357), maser-constrained arm geometry. Extrapolated light and fitted gains are modeling choices. |
| Population prior | [Sharma et al. (2011), Galaxia](https://arxiv.org/abs/1101.3561); synthetic populations. The population-color constants and fitted camera are preserved with b30, rather than claimed as measured visible colors. |
| Interior sky | Ernie Wright, NASA [Deep Star Maps 2020, SVS 4851](https://svs.gsfc.nasa.gov/4851/), Milky Way-only 8192 × 4096 linear map, ICRF/J2000. [Credits and source processing](source/sky/provenance.json). |
| Catalogue dots | The unchanged 33,820-row [stack](source/dots/stack.json), assembled from the per-catalogue `points.json` and merge records beside it. Six proximity files preserve position, color, radius and order. |
| Stellar admission boundary | The [extent record](source/stellar-extent.json) uses 26 kpc as a presentation boundary. [López-Corredoira et al. (2018)](https://arxiv.org/abs/1804.03064) detect disc stars beyond 26 kpc; this boundary is not the observed end of the disc. |

The [manifest](source/manifest.json) binds the preserved inputs and published references. Compressed pre-slice fields, radiance and the accepted NASA low-frequency panorama are restored from the source cache. Their generation and compression owners are retained; ordinary replay does not refit the model or require the research checkout. Source notices and catalogue-specific reuse terms remain beside their original inputs. The old OpenSpace volume, ESA backing, RR Lyrae overlay and globular-dot bank are historical source records and are not drawn by this presentation.

## Evidence

- Full production replay: **33/33 slab PNGs** (13/13/7, copies merged) match the accepted bank byte for byte, and a second bake reproduces the inventory exactly; **6/6 sky faces** match the accepted path sky. Every slab has at least **three zero-alpha border cells** on every side.
- Phone and tablet memory (2026-10-22): the earlier 52/52/26 bank drew three copies of each of its 130 slabs, **390 full-screen layers**. On a Galaxy S23 Chrome caps tile memory at 256 MB; turning the galaxy it ran short in 827 of 867 tile assignments and drew layers empty in **248 frames of an 8 s turn**, the flicker. On the iPad the bank cost **191, 185 and 214 ms** composites as it joined or left. With 13/13/7 slabs and merged copies (at most 33 layers) the same turn ran short in **0 of 541** assignments; 3 to 7 frames still drew a tile late, against 0 for the bank before the 52/52/26 one. Fitted against the same reference, the slab-local error fell from relative L1 **0.20/0.20/0.15** to **0.13/0.13/0.07**.
- Far images: **1,279,831 compressed bytes (1.3 MB to download); 16,631,252 decoded RGBA bytes (17 MB)**, against 3,418,890 and 52,027,304 for the 52/52/26 bank. Each image holds its three optical copies: one layer a slab. Texture allocation and compositor copies are additional costs.
- Banding: the 52/52/26 bank brought the low-angle stripe amplitude to 3.3% of brightness; the coarser 13/13/7 slabs leave wider gaps, so faint stripes at the edges can return at low angles.
- iPad (iPad12,1, iPadOS 26.5), 52/52/26 bank, drag at the stripe view, 390 frames, three interleaved runs (2026-10-19): with steady optical copies, frames over 20 ms **7, 5, 6** against **12, 13, 27** before; over 33 ms **1, 1, 1** against **5, 6, 13**. Late frames remain only at load and release. The cause was optical copies crossing opacity 0 or 1 and leaving or joining the layer tree mid-turn, which made WebKit recomposite for 25–37 ms.
- Focused integration checks: **79 passed**, covering local transfer, golden replay, image extension, axis handover, equal-image light, proximity admission, sky selection, exposure and coast writes. Fresh-fixture bake/loader checks: **15 passed**. Broader commit-boundary results are recorded on the draft PR.
- The step-19 extension preserves all original stacking centers and affine image calibration. X/Y pitch is **32/13 kpc**; Z pitch is **6.4/7 kpc**. Larger image rectangles do not widen the slab spacing or change the frame used by handover.

These checks establish reproducibility, geometry and state behavior. They do not establish exact spectral transfer, every-angle visual continuity, calibrated photometry, or iPad performance beyond the drag measured above.

Inspected production-build captures: Chromium 148, 1024 × 640, DPR 1. The far scene retains exactly 403 elements. No Milky Way dot bank is requested outside; the Solar view requests all six proximity levels and its plain-star bank. Labels and navigation remain present.

The low-angle capture also shows the known near-sheet occlusion; the side camera can black out. These are retained limitations of the accepted bank.

## Known problems

- **Stripes remain close up at low angles,** more visibly with 13 X/Y slabs than with the earlier 52. Continuous handover reduces abrupt set changes; it does not make the finite slabs continuous material.
- **Merged copies are exact only for faint material.** One layer at opacity gain / 3 scales a slab's merged alpha linearly where three copies compose it. Face-on, an opaque pixel draws at a third and a half-opaque one at 0.29 instead of 0.5: over the 13/13/7 bank that is **31% of the slabs' total alpha** face-on and **0.8%** at grazing views, almost all of it in the 7% of pixels above alpha 0.25 (dense dust). Two layers a slab would be exact but ran a phone out of tile memory again (56 to 62 frames with missing tiles), and fewer, thicker slabs showed gaps between them; the owner accepted the merged look on the phone (2026-10-22).
- **X/Y criss-cross remains near 45° azimuth.** The later experimental finalist was rejected and is excluded.
- **Some far-only camera views black out.** Smooth coefficients and exposure do not prove smooth rendered pixels; the compositor/near-sheet cause remains unresolved.
- **Scalar alpha limits color fidelity.** A single source-over alpha cannot carry three spectral transmittances or reproduce a nonlinear display transform applied after whole-ray integration. The fitted display is not calibrated visible photometry.
- **Edge-on size differs from the uncut model.** Stacking bounds remain the accepted 32 × 32 × 6.4 kpc box; growing image-plane support does not restore all depth outside that box.
- The inherited sky cube has unresolved corner coverage.
- One route sky is retained alongside NASA's sky. The other thirteen accepted skies (the rest of the Sun path, the owner approaches and the Sgr A* path) are no longer shipped: fading through them mid-zoom dropped frames on the iPad (2026-10-21). Their recipe entries can return with a transition that does not.

<details>
<summary>Method and complete replay</summary>

### Local slabs and soft borders

The canonical field has 401 × 401 × 161 nodes at 80/80/40 pc. Each slab integrates only its own emission, scatter and dust, then applies the fitted population camera and frozen outside display scale **0.044094241663168915**, asinh stretch 6 and gamma 0.9. It never attributes a completed column back to its slabs.

An explicit 601 × 601 × 361 in-plane field extends faint image support. The original field still supplies every canonical sample. Each image is cropped to its nonzero 8-bit alpha envelope plus empty cells; no feather, resampling, support clip or optimizer changes the original crop. The original affine columns and CSS raster phase survive compilation. The small independent step-one golden fixture preserves exact expected PNG bytes as numeric arrays and defends the original unextended transfer; the complete replay also checks the shipped extension.

### Completed images and handover

Z owns most directions. X and Y join near edge-on and mix continuously around their azimuth bisector. The Z/side window rises with approach distance, normalized by the original physical frame. Completed stack images keep black mattes; source-over coefficients maintain constant total weight, capped at 0.999 for Safari. All three stacks stay resident. Each slab image already holds three coincident optical copies (alpha 1 − (1 − a)³), drawn as one layer at opacity gain / 3: exact for faint material, slightly lighter where a slab is nearly opaque. A shown optical copy keeps the 8-bit alpha step nearest its exact value, held inside [0.001, 0.999] (within 1/510 of exact), and stays joined while its stack is visible, so turning never crosses opacity 0 or 1 or changes the layer tree. Coast publication changes only transforms and opacity.

### Inside skies, exposure and stars

One fixed sky, 20,000 light-years out on the accepted Sun path, stands between the far slabs and NASA's sky, at the fixed Sun exposure of 4.5.

One smooth position-dependent log gain interpolates between the Sun and Sgr A* anchors. Far layers fade from full at **9 kpc** to zero at **1.5 kpc** and leave the page once the inside sky covers them. Keeping them under the sky until the camera stopped made a phone run out of tile memory, so the layers drew empty every other frame. Frozen coast membership and driven-flight staging use the existing shared owners.

Catalogue admission uses physical proximity, not projected size. Outside the prepared disc, no catalogue-dot bank is fetched or drawn. Inside, six levels load through the accepted distance windows, preserving every input row. Plain-star admission follows the same boundary; labels and navigation use their existing owners. The rolled-back overlap experiment is excluded.

### Replay from a clean checkout

The command restores the accepted compressed source inputs, decompresses them locally, bakes the far bank and skies, splits the restored catalogue, and refreshes the inventory. Allow 8 GB of working space beyond installed runtime assets. Python needs NumPy and Pillow only; CUDA is unnecessary for this compact-input replay.

```sh
pnpm install --frozen-lockfile
pnpm setup:assets
python3.12 -m venv .local/milky-way-python
.local/milky-way-python/bin/python -m pip install numpy==2.5.4 Pillow==13.0.0
CSSEARTH_TORCH_PYTHON="$PWD/.local/milky-way-python/bin/python" node packages/bake/cli/prepare-milky-way-layers.mts
CSSEARTH_GALAXY_FULL_REPLAY=1 CSSEARTH_TORCH_PYTHON="$PWD/.local/milky-way-python/bin/python" pnpm test:run 'packages/bake/authoring/milky-way-dust/*.test.mts'
```

`--pilot` runs the exact producer on the Z set and the last sky in the recipe. `--restore-only` restores source inputs without baking. The lower-level slice command retains the explicit in-plane-field option; its original default transfer is independently golden-tested. The shipped top-level command always selects the accepted extended field and the 52/52/26 counts; the lower-level command's default counts stay 26/26/26. Set `CSSEARTH_GALAXY_FULL_REPLAY=1` to run the complete production-bank replay; ordinary focused tests skip that expensive check.

Rejected two-layer, texel calibration/fitter, directional atlas, support-clipping and nonuniform-placement paths are removed. The browser-free blending lab is excluded because it depends on research outputs and retains an unresolved qualification gate. No later finalist or unrelated nebula work is included.

</details>
