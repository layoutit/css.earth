# Titan

Standalone Saturn moon, prepared through the shared authored-object contract.
Lenses are Cassini ISS **Near infrared** (938 nm) and **Radar** (SAR/HiSAR),
with shared Shadows, Orbit, camera, input and navigation behavior. See [SOURCE.md](SOURCE.md) for
coverage and interpretation limits.

```sh
node tools/objects/dist/operations.js acquire titan
node tools/objects/dist/prepare-authored.js titan --write
pnpm setup:assets --object=titan
```

Source acquisition and preparation are separate from runtime installation.
Large source images are reacquirable and excluded from Git.
