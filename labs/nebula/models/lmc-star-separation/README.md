# Three-source LMC compact-light trials

VISTA, Horálek optical and WISE infrared were selected for processing after alignment. This experiment produces full-footprint **2D diffuse and compact-residual previews**; it does not replace or rebake the current 3D cloud. The reusable method is [METHOD.md](../../METHOD.md).

## Frozen controls

- Original downloads and native pixel grids are pinned in each recipe. All three inputs decode to 8-bit RGB. VISTA and Horálek embed the sRGB IEC61966-2.1 profile; the WISE JPEG is untagged. Separation preserves their encoded samples without an ICC conversion; generated PNGs are untagged and delivery previews use sRGB. A differently profiled source needs an explicit color-managed master and new hash before reuse.
- [The alignment report](../lmc-candidates/source/alignment-report.json) binds source hashes and the exact active homographies/WCS. The batch driver validates **all selections before starting any separation**, including the underlying gate hashes and current image-catalogue geometry.
- Detection threshold and profile gates are identical across the three recipes. VISTA and Horálek exceeded the initial 250,000-candidate workspace; Horálek now has an explicit capacity of 1,000,000. VISTA also exceeded that capacity: a full-grid audit found 1,736,457 distinct maxima with zero tied/adjacent plateau duplicates, so its capacity is 2,000,000. No detections are silently dropped. The stronger-removal revision lowers only `minimumSigma` from the default 0.65 to 0.25 native pixels; detection, maximum width, elongation, correlation, connected-profile and mask limits remain unchanged.
- Comparison sheets use exposure 1 and gamma 1 on every component. Native color is not globally brightened, darkened or normalized. Interactive lab tone controls remain available.
- No crop, density cutoff, global median output, sky subtraction, volume assignment or new 3D bake occurs.

## Replay from a clean checkout/cache

Run from anywhere inside this checkout. Python 3.9 matches the recorded preparation environment; downloads require access to the original publishers.

```sh
cd "$(git rev-parse --show-toplevel)"
pnpm install --frozen-lockfile
/usr/bin/python3 -m venv .local/nebula-lab/registration/venv
.local/nebula-lab/registration/venv/bin/python -m pip install -r labs/nebula/models/lmc-star-separation/requirements.txt
.local/nebula-lab/registration/venv/bin/python labs/nebula/src/process-image-candidates.py labs/nebula/models/lmc-star-separation/plan.json
node --experimental-strip-types labs/nebula/src/run.ts prepare-overlay-variants labs/nebula/models/lmc-star-separation/plan.json
pnpm lab:nebula
```

The batch driver acquires missing pinned originals and fails on source, recipe, alignment or geometry drift. It reuses the committed passing registration evidence; it does not refit image placement. `--check-only` performs the input preflight without separation. The independent [WISE registration replay](../lmc-candidates/source/wise-registration/README.md) documents catalogue acquisition and its coordinate check separately.

Open [Alignment](http://127.0.0.1:4331/?subject=lmc-clouds&tab=alignment), select one of these images and use **Image layer** to compare Original, Diffuse trial and Compact residual. Camera, placement, opacity and tone remain shared. Other catalogue images retain their originals.

## Artifacts and interpretation

```text
models/lmc-star-separation/
├── plan.json                  # Selected recipes + pinned passing alignment report
├── <image-id>.json             # Native source + separation settings
├── receipts/                  # Native output hashes, counts, accounting and limits
├── variants.json              # Original/derived preview associations
└── prepared/                  # Bounded delivery WebPs

.local/nebula-lab/star-separation/<image-id>/
├── star-detections.json        # Coordinates saved before subtraction
├── star-detection-map.png
├── accepted-stars.json        # Accepted profiles and rejected-reason counts
├── star-mask.png
├── diffuse.png                # Full native lossless grid
├── stars.png                  # Positive compact residual, same grid
├── comparison.png             # Shared-tone source/diffuse/residual/mask sheet
└── receipt.json               # Reproducibility and verification record
```

The acceptance checks require exact integer color recombination, unchanged pixels outside accepted masks and exact decoded PNG round trips. Synthetic tests cover an isolated star, extended filament, broad nebula, empty field, overlapping masks and 16-bit/alpha behavior. Mutation checks remove subtraction or add global smoothing and confirm those guarantees fail.

These checks do not make the output a scientifically star-free nebula. Local interpolation cannot identify every intrinsic knot, crowded blend or saturated wing. Visual acceptance of the diffuse target remains separate from running the process successfully. The compact residual is inspectable image light, not a new measured 3D stellar catalogue.

## Recorded outcome

All three full native runs completed. Diffuse + compact residual reproduce source color exactly, pixels outside accepted masks are unchanged, and native PNG round trips are exact. The stronger results also preserve every pixel contribution previously assigned to the compact residual. VISTA accepts 5.19× as many profiles, WISE 19.2% more, and Horálek 4.5% more. The improvement is source-dependent: broader/blended stars still dominate the remaining optical field. These are processing checks, not acceptance of a new 3D cloud.

| Source | Detected peaks | Previous accepted profiles | Stronger accepted profiles | Mask area |
|---|---:|---:|---:|---:|
| VISTA | 1,736,457 | 92,404 | 479,231 | 12.03% |
| Horálek | 330,036 | 63,579 | 66,443 | 19.91% |
| WISE | 128,895 | 48,970 | 58,386 | 6.35% |

Overview and native-detail inspection show compact light removed while bright/broad/crowded stars remain. Horálek's inspected emission structure is retained; WISE's original atlas seams remain visible. **These are comparison trials, not final star-free textures.** The next decision is which source and separation quality to develop before assigning new depth.

For the stronger-removal revision, VISTA native crops showed 261 → 1,904 accepted compact profiles in an outer field, 259 → 679 around bright nebulosity, and 219 → 548 in the bar after lowering only the minimum width. Raising the profile threshold instead produced more zero-covariance cores; broader shape/mask trials introduced dark patches and were rejected. The selected setting preserves the existing broad-nebula boundary. A regression reads all three actual recipes, removes an undersampled star and requires adjacent extended emission and all pixels outside accepted masks to remain exact. Restoring the old minimum makes that test fail. These comparisons establish the bounded improvement; they do not establish foreground membership or complete star removal.

The six 4096-pixel-bounded WebPs are display previews derived from the native lossless outputs. Keep the originals and derived layers together when evaluating color; the residual's isolated light often needs an inspection exposure adjustment.

Final verification includes targeted native-grid/mutation tests, the lab test suite, typechecking, and the actual Alignment browser flow for source/layer switching with retained camera/geometry and shared tone. Independent review found no in-scope blocking issue. Broader repository checks retain the existing five missing-asset/fixture shell failures and the site build's `sun-starfield-back-standard.webp` drift; these are unrelated to this lab change.
