# 67P comet PoC

Open `/comet-67p/` to inspect the Rosetta nucleus. Drag and zoom use the common application camera; **Shadows** switches baked lighting. The full source interpretation and limitations are in [SOURCE.md](SOURCE.md); credits are in [NOTICE.md](NOTICE.md).

Choose **OSIRIS observation** for the grayscale orange-filter image from 5 August
2014. Disk illumination is approximately normalized before preparing the shared
lighting banks. Gray grid marks missing or rejected photograph samples; the
source mesh remains complete. The default **Shape model** lens is unchanged.

With a supported Node version and dependencies installed:

```sh
pnpm setup:assets --object=comet-67p
pnpm dev
```

To acquire and reproduce the object from source:

```sh
pnpm build:preparation
node tools/objects/dist/operations.js acquire comet-67p
node tools/objects/dist/prepare-authored.js comet-67p --write
node tools/prepare-navigation.mjs
node tools/prepare-object-json.mjs
```

The authored neutral PNG and derived context PNG are checked in. Acquisition restores the original OBJ, OSIRIS GEO/quality IMG pair, NAVCAM reference, ESO panorama and Inter font and verifies their pinned hashes. `prepared/object.json` is generated at installation/build time; the prepared geometry and runtime inventory remain versioned. No other object is synthesized as a fallback.

Focused checks:

```sh
node --test tests/objects/unit/comet-67p/*.test.mjs
pnpm test:browser http://127.0.0.1:4257 comet-67p
pnpm test:browser:conformance http://127.0.0.1:4257 comet-67p
```

The [OSIRIS integration record](../../../docs/comets/67P-OSIRIS-INTEGRATION.md)
contains the new lens's source, lighting and browser evidence. The original
comet delivery remains in the [shared qualification record](../../../docs/comets/QUALIFICATION.md).
