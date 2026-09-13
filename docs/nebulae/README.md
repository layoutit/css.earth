# Prepared nebulae in the shared world

M42, Helix and M2–9 use the retained `volume-lens-bank` capability, shared camera, focus card and source controls. They do not have separate scene owners. Open `/sun/?focus=m42`, `/sun/?focus=helix` or `/sun/?focus=m2-9`, or double-click their scene labels.

Search by common name or catalogue alias (Orion/M42/NGC 1976, Helix/NGC 7293, Twin Jet/M2–9), or browse the Nebulae category. Search rows come from each object's nebula record; selecting a result uses the current scene's shared fly-to without loading another page.

| Object | Method | Lenses | Adopted distance |
| --- | --- | --- | --- |
| [M42](../../src/objects/m42/README.md) | Image emission with an evidence-guided coherent depth surface | ESO optical and VISTA infrared | 414 ± 7 pc |
| [Helix](../../src/objects/helix/README.md) | Multi-image emission with a molecular velocity scaffold | ESO WFI optical, VISTA infrared, wide optical | 216 −12/+14 pc |
| [M2–9](../../src/objects/m2-9/README.md) | Axially symmetric image-conditioned emission | Hubble optical | 650 pc, uncertain |

These are plausible **relative display emission** models, not measured 3D gas density. Compact lights retain image positions and display photometry; their conditional depths do not establish stellar distance or membership. The accepted M2–9 baseline has no star catalogue, so none is invented.

## Reproduce from a clean checkout

Requires Node 22.18+, pnpm 10.33.0, Python 3.9–3.12 with pip/venv, a supported TensorFlow wheel, internet access and disk space for native images. Run from the repository root. This uses the existing lab processing environment without opening its UI or restarting a running lab.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/src/run.ts prepare-nebula-objects --if-missing
pnpm dev
```

Success prints `NEBULA_OBJECTS_COMPLETE` with all three objects and their result identities. A subsequent `--if-missing` invocation hashes every installed texture before reporting `verified`. Missing derived products are restored; changed pinned inputs fail. The compiler restores observations, NOX products, structure evidence and optional molecular measurements through their existing source owners. M2–9 replays its symmetry recipe if its local volume is absent.

Source recipes, provenance, requests and small object descriptors are committed. Textures and receipts under each object's `prepared/`, native caches and intermediate results are ignored. Runtime consumes prepared geometry and pixels only.

## Coordinate handoff

The compiler uses west/north/away angular coordinates. Delivery reflects physical X, then embeds proper east/north/away axes in ICRS. PolyCSS stores physical YXZ, so this reflection changes the second matrix row. Stars receive the same reflection. Delivery restores the local origin offset; one angular unit uses `distancePc × metresPerParsec × π/648000` metres. This tangent-plane approximation does not turn assumed depth into measured geometry.

M2–9 has a published 113.6° AVM rotation and a 58.035″ image width. Its existing caption-removing crop is transferred to the same HST photograph using the recorded registration evidence. The captioned full APOD raster is not used as an angular field.

## Update a delivery

`source/request.json` fixes compiler controls, evidence weights and saved image transforms. `source/delivery.json` pins that request and scientific recipe inputs, records the assessed result, physical embedding and display framing. Source switching changes prepared star material while retaining every ID/position and the shared camera.

The current checked-in compiler can produce a new immutable result for those settings. The generated receipt records both the historically assessed identity and the actual reproduced identity. A new result still needs front, oblique and side inspection; numerical agreement alone does not establish visual acceptance.

## Integration evidence

The main-site browser check (`site/test/nebula-world-browser.mts`) exercises all three objects and six lenses through the real shared input surface: label double-clicks navigate with one document load, lens changes retain the camera and scene nodes, and approaching M42/Helix enlarges their prepared compact lights. Front and oblique captures were inspected for this delivery. M2–9 has no prepared star catalogue. Existing image-coverage/background artifacts remain; these checks do not establish measured three-dimensional density.

Deleting one prepared M42 texture and replaying preparation restored its exact original hash and retained the assessed result. The full preparation command verified all three deliveries. A fresh native-image/NOX environment replay was not performed for this integration; the clean-checkout sequence above documents its required dependencies.
