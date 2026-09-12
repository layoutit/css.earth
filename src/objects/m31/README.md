# M31 image-layer preparation

This package preserves a documented high-resolution crop derived from ESA/Hubble's publisher-supplied DSS2 optical image and bakes three retained directional CSS image banks. The source-facing bank combines one high-frequency midplane residual with a diffuse component distributed through 32 optical-depth-weighted slabs. Cross-axis banks sample the same separable display model for continuous rotation.

Depth is a 1 kpc parametric display model, not recovered stellar distance. Compact features are not classified or placed individually in 3D. The checked image includes the full visible galaxy, foreground stars and background objects; no point-source removal is applied.

Sources, recipes and expected geometry/resource hashes remain tracked. Layer WebPs are committed with their hashes: lossy WebP encoding is not byte-identical across platforms, so a checkout verifies the accepted bytes at install and only `pnpm prepare:environment-images --verify-replay` rebakes them. See the [shared bake commands](../../../labs/nebula/docs/baking.md).
