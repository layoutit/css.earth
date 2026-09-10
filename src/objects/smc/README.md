# SMC image-layer preparation

This package preserves a checked optical observation and bakes three retained directional CSS image banks. The source-facing bank combines one high-frequency midplane residual with a diffuse component distributed through 32 optical-depth-weighted slabs. Cross-axis banks sample the same separable display model for continuous rotation.

The 25 kpc depth is an authored envelope constrained by the broad line-of-sight tracer population; it is not a universal thickness or per-pixel distance map. Compact features are not classified or placed individually in 3D. No point-source removal is applied. The SMASH image covers the main optical body, not the full Bridge, Wing or tidal debris. Released foreground and background sources remain.

Sources, recipes and expected geometry/resource hashes remain tracked. Layer WebPs are generated and ignored; app startup restores them without changing the accepted scene. See the [shared bake commands](../../../labs/nebula/docs/baking.md).
