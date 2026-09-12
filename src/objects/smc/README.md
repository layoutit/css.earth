# SMC image-layer preparation

This package preserves a checked optical observation and bakes three retained directional CSS image banks. The source-facing bank combines one high-frequency midplane residual with a diffuse component distributed through 32 optical-depth-weighted slabs. Cross-axis banks sample the same separable display model for continuous rotation.

The 25 kpc depth is an authored envelope constrained by the broad line-of-sight tracer population; it is not a universal thickness or per-pixel distance map. Compact features are not classified or placed individually in 3D. No point-source removal is applied. The SMASH image covers the main optical body, not the full Bridge, Wing or tidal debris. Released foreground and background sources remain.

Sources, recipes and expected geometry/resource hashes remain tracked. Layer WebPs are committed with their hashes: lossy WebP encoding is not byte-identical across platforms, so a checkout verifies the accepted bytes at install and only `pnpm prepare:environment-images --verify-replay` rebakes them. See the [shared bake commands](../../../labs/nebula/docs/baking.md).

## Accepted bytes

Re-accepted on 2026-09-12 on macOS arm64 with sharp 0.35.3 (libwebp 1.6.0): the replay reproduced 95 of 96 layers byte for byte and encoded `layers/x-13.webp` 4 bytes shorter than the earlier acceptance, so its resource digest and the prepared pin were updated to the bytes now committed. Values did not change; the recipe and sources are the same.
