# Albiorix

Lightcurve-constrained ellipsoid through the shared object contract. See [SOURCE.md](SOURCE.md) for assumptions and the dataset survey.

Install prepared runtime assets with `pnpm setup:assets --object=albiorix`. No source preparation is needed for this installation.

To rebuild from sources after building the preparation tools:

```sh
node tools/objects/dist/operations.js acquire albiorix
node tools/objects/dist/prepare-authored.js albiorix --write
```

The radius table, neutral no-data material and reviewed context image are checked in. The ESO panorama and Inter font are restored by their pinned acquisition plan. Shape assumptions and context-camera parameters live beside those inputs.
