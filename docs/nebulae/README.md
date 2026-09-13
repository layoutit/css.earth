# Prepared nebulae in the shared world

M42, Helix, M2–9, Pleiades, Crab and Lagoon use the retained `volume-lens-bank` capability, shared camera, focus card and source controls. Open `/sun/?focus=m45`, `/sun/?focus=m1` or `/sun/?focus=m8` for the new scenes; the existing `m42`, `helix` and `m2-9` focus links remain available. Double-clicking a scene label uses the same shared navigation.

Search by common name or catalogue alias (Orion/M42/NGC 1976, Helix/NGC 7293, Twin Jet/M2–9, Pleiades/M45/Seven Sisters, Crab/M1/NGC 1952, Lagoon/M8/NGC 6523), or browse the Nebulae category. Search rows come from each object's nebula record; selecting a result uses the current scene's shared fly-to without loading another page.

| Object | Method | Lenses | Adopted distance |
| --- | --- | --- | --- |
| [M42](../../src/objects/m42/README.md) | Image emission with an evidence-guided coherent depth surface | ESO optical and VISTA infrared | 414 ± 7 pc |
| [Helix](../../src/objects/helix/README.md) | Multi-image emission with a molecular velocity scaffold | ESO WFI optical, VISTA infrared, wide optical | 216 −12/+14 pc |
| [M2–9](../../src/objects/m2-9/README.md) | Axially symmetric image-conditioned emission | Hubble optical | 650 pc, uncertain |
| [Pleiades · M45](../../src/objects/m45/README.md) | Authored finite dust-display surface and observed stellar catalogue | NOIRLab + Niittee optical composite, NOIRLab optical, two Spitzer composites, WISE | 136.2 ± 1.2 pc |
| [Crab · M1](../../src/objects/m1/README.md) | Released SITELLE ejecta samples with conditional expansion depth and separate pulsar-wind components | Hubble, two Webb views, Spitzer, VLA, Chandra | 2,000 pc adopted model scale |
| [Lagoon · M8](../../src/objects/m8/README.md) | Authored coherent front with local published structure constraints | ESO optical, VISTA infrared, Spitzer infrared | 1,326 −69/+77 pc |
| [LMC](../../src/objects/lmc/README.md) | Registered image colors on a simulated stellar-density prior | VISTA infrared, Horálek visible light, WISE infrared | The Local Group catalogue owns its distance |

These are **relative display emission** models, not measured 3D gas density. The six Galactic nebulae use [surrounding Gaia/Bailer-Jones stellar fields](stellar-fields.md), independent of source-image boundaries. Their parallax-informed distance estimates retain uncertainty; retained named Pleiades stars, the Crab pulsar and bright Helix image cores keep explicitly conditional display depths. LMC keeps its separate model-conditioned stellar catalogue. Pleiades and Lagoon retain thin-layer and source-coverage artifacts; Crab's historical color-through-depth material defect remains separately documented. Each body README distinguishes those model limits from app integration.

## Reproduce from a clean checkout

Requires Node 22.18+, pnpm 10.33.0, Python 3.9–3.12 with pip/venv, a supported TensorFlow wheel, internet access and disk space for native images. Run from the repository root. This uses the existing lab processing environment without opening its UI or restarting a running lab.

```sh
pnpm install --frozen-lockfile
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
pnpm prepare:nebulae
pnpm dev
```

`pnpm prepare:nebulae` handles **all 23 configured lenses**, then regenerates their dataset cards and the shared source/telescope graphs. Success prints `DELIVERY_CACHED` or `BAKE_COMPLETE` for LMC, `NEBULA_OBJECTS_COMPLETE` for the six smaller nebulae, and the prepared mission/machine/dataset totals. A cached invocation hashes every installed texture before reporting `verified`; it does not rerun NOX. Missing derived products are restored; changed pinned scientific inputs fail. M2–9 replays its symmetry recipe if its local volume is absent. The delivery receipts identify actual output versions; a successful replay is not an independent visual or scientific acceptance.

Source recipes, provenance, requests and small object descriptors are committed. Textures, prepared descriptors and receipts under each object's `prepared/`, native caches and intermediate results are ignored. Runtime consumes prepared geometry and pixels only.

## Spectral datasets and source cards

| Object | Every lens rebuilt by the command | Saved processing choices |
| --- | --- | --- |
| M42 | `eso-optical`, `eso-vista` | `source/request.json`, `source/delivery.json`, and the pinned lab compiler/evidence recipes |
| Helix | `eso-vista`, `eso-wfi`, `eso-wide` | The same compiler contract, including its molecular-velocity evidence |
| M2–9 | `hst-optical` | The symmetry recipe and `source/image-frame.json` |
| M45 | `optical-composite`, `noirlab-optical`, `spitzer-irac`, `spitzer-irac-mips`, `wise-four-band` | Delivery and request records; compiler, observed stellar catalogue and the declared optical-composite recipe |
| M1 | `hubble-optical`, `webb-infrared`, `webb-components`, `spitzer-infrared`, `vla-radio`, `chandra-xray` | Delivery and request records; sampled ejecta/pulsar-wind recipe and per-image registration records |
| M8 | `eso-optical`, `eso-vista`, `spitzer-mid-infrared` | Delivery and request records; selected three-image observations and the local evidence-guided depth recipe |
| LMC | `vista-infrared`, `horalek-widefield`, `wise-wide-infrared` | `labs/nebula/models/lmc/bake.json`, accepted registration, per-image appearance and `source/lenses.json` |

The native images and their completed star-removal or explicit compact-emission-preservation products feed reconstruction. **The source-card previews never feed the cloud bake.** Shared geometry and star positions remain independent of lens selection; each lens carries its registered color treatment and saved display settings. Pleiades' composite reference preview is Niittee's original wide photograph before NOIRLab detail fusion. Crab's Hubble 2017 bridge supports registration and is excluded from selectable lenses. M2–9 gains an independently catalogued surrounding field; its symmetry image does not infer those stellar positions.

Each object owns `source/presentation.json` and a source manifest with image identities, credits, capture evidence and supporting scientific references. `prepare:nebulae` and `prepare:sources` generate `prepared/presentation.json`, standard `cssearth-object-provenance@3` lineage, bounded WebP previews and shared source usage. These generated files are ignored. An ordinary rebake takes the current descriptor's output identity; it does not require editing a duplicate presentation hash.

The site reuses the planets' dataset selector, descriptions, details and source/telescope sidebar. Selecting a lens updates that lens's source context and URL while retaining the world camera and scene. Supporting observations remain distinguishable from the selected image; papers do not become spacecraft observations. Horálek's camera remains unidentified in the retained evidence, so its attribution names the photographer without inventing an instrument.

## Using the shared dataset panels

Select a dataset on the left to recolor the retained cloud. Its image credit and supporting observations appear on the right. The catalogue-star toggle preserves the common positions across spectral lenses. Dataset rows show only image names; the selected image dimensions and passbands are in Factsheet. Scene labels follow the top of each projected cloud and retain fading and double-click navigation.

![Pleiades optical composite in the shared galaxy app](../images/nebulae/m45-galaxy.png)

Pleiades: Taavi Niittee / Tõrva Astronomy Club wide optical image, with central
NOIRLab detail. The photo coverage and remaining inferred thin-cloud limitations
are described in the object record above.

![Crab optical cloud in the shared galaxy app](../images/nebulae/m1-galaxy.png)

Crab: NASA/ESA, Allison Loll, Jeff Hester and Davide De Martin; released SITELLE
spatial samples supply the conditional ejecta structure.

![Lagoon optical cloud in the shared galaxy app](../images/nebulae/m8-galaxy.png)

Lagoon: ESO optical. These are main-app captures, with the shared dataset panels,
catalogue fields and labels above the projected clouds. Front and oblique views
are checked separately; a front screenshot does not prove physical depth.

## Distant appearance

Each delivered lens includes transparent, pre-rendered views of its completed cloud. At small projected screen sizes, the renderer uses these billboards; approaching the cloud hands back to the original volume slices. This changes the amount of displayed geometry, not the nebula's physical bounds, adopted distance or close-view resolution. Viewing direction selects from the fixed prepared views; the browser never generates their pixels.

The initial bank contains 26 directions at 256px. Up to three contribute at once below a 128 CSS-pixel projected bounding diameter. Between 128 and 256px, the cloud fades into its retained volume; above 256px, only the original slices render. Hidden slice stacks receive no camera publications. These distant orthographic views approximate parallax and perspective; they are not replacements for the close cloud.

Delivery creates the views after applying the shared sky-frame transform, using that lens's prepared brightness. The same source recipe rebuilds both representations from the completed volume, without another star-removal pass. The delivery receipt pins the generator and volume contract, so `--if-missing` rebuilds after their implementation changes and verifies every generated image on reuse.

## Coordinate handoff

The compiler uses west/north/away angular coordinates. Delivery reflects physical X, then embeds proper east/north/away axes in ICRS. PolyCSS stores physical YXZ, so this reflection changes the second matrix row. Stars receive the same reflection. Delivery restores the local origin offset; one angular unit uses `distancePc × metresPerParsec × π/648000` metres. This tangent-plane approximation does not turn assumed depth into measured geometry.

M2–9 has a published 113.6° AVM rotation and a 58.035″ image width. Its existing caption-removing crop is transferred to the same HST photograph using the recorded registration evidence. The captioned full APOD raster is not used as an angular field.

## Update a delivery

`source/request.json` fixes compiler controls, evidence weights and saved image transforms. `source/delivery.json` pins that request and scientific recipe inputs, records the assessed result, physical embedding and display framing. Source switching changes prepared star material while retaining every ID/position and the shared camera.

The current checked-in compiler can produce a new immutable result for those settings. The generated receipt records both the historically assessed identity and the actual reproduced identity. A new result still needs front, oblique and side inspection; numerical agreement alone does not establish visual acceptance.

The main site's prepared-resource glob includes the generated proxy PNGs automatically. After preparing updated deliveries and rebuilding a changed renderer, reload the main page to load its new fixed bank; no separate nebula asset-manifest restoration is needed.

## Integration evidence

`site/test/nebula-datasets-browser.mts` checks prepared lenses, preview decoding, image-source links, retained camera/scene, star toggles and responsive dataset/factsheet panels. Shared source/graph tests verify canonical bindings and actual package ownership. The original pass covered nine lenses. The current shared-world browser checks cover the fourteen Pleiades, Crab and Lagoon lenses, with a separate recorded refresh after their catalogue-field replacement. These checks concern delivery and presentation, not the physical validity of inferred depth.

The original main-site browser check (`site/test/nebula-world-browser.mts`) exercised M42, Helix and M2–9 and their six lenses through the real shared input surface: label double-clicks navigated with one document load, lens changes retained the camera and scene nodes, and approaching M42/Helix enlarged their prepared compact lights. Front and oblique captures were inspected for that delivery. M2–9 has no prepared star catalogue. That historical result does not cover Pleiades, Crab or Lagoon. Existing image-coverage/background artifacts remain; these checks do not establish measured three-dimensional density.

In the original three-nebula integration, deleting one prepared M42 texture and replaying preparation restored its exact original hash and retained the assessed result. That preparation run verified M42, Helix and M2–9. A fresh native-image/NOX environment replay was not performed in that check; the clean-checkout sequence above documents its required dependencies. The new Pleiades, Crab and Lagoon READMEs identify their own reproduced results and distinguish preparation checks from visual acceptance.

### Current app evidence · 14 September 2026

The fourteen Pleiades/Crab/Lagoon lenses passed source/Factsheet, decoded texture,
retained-camera, label placement and distant-view checks. After the surrounding
fields changed, default M45/M1 views and all three M8 views were repeated; Helix
was added to the physical point-projection and toggle checks. Final Helix and M8
passes inspected all six lenses from front and oblique directions, with no
browser or HTTP errors. The 34 Helix cores persist across source switches, and
M8’s previously clear local rectangular boundaries now fade softly.

The M45/M1 captures above were taken on `40cc51d00` content; subsequent changes
leave their prepared geometry, every image identity and all points identical.
M8 and Helix captures include the following fixes to that revision: union-source
core retention, anchor photometry, source-card text corrections and M8’s saved
edge tapers. The object READMEs and generated delivery receipts identify the
actual compiled results. These are checks of app presentation, not physical
reconstruction accuracy. Coarse clouds, residual halos and side-view artifacts
remain qualified in the individual records.

Final local checks: 481 lab tests passed, two optional Helix integration tests
skipped; strict lab/tools/browser-owner TypeScript; source/lens/alias checks;
renderer label and shared focus-card tests; Astro check. The full planet suite,
a cold native-processing replay and new quantitative axis-handoff qualification
were not run for this integration.
