# cssEarth project contract

- Mount exactly one object scene at a time. Navigation entries navigate; they never coexist as rendered objects.
- Saturn is the accepted visual-quality reference. Shared input policy belongs in `site/runtime-policy.mjs`; browser conformance proves common interaction behavior. Keep object-specific rendering facts inside each object package. Do not fabricate fallback scenes for planned objects.
- Keep one open-ended `OBJECTS` registry and one generic object adapter. The Sun, planets, and future moons, dwarf planets, asteroids, or other bodies use the same object contract. The fixed eight planet ids are a reporting filter, not a second registry or adapter.
- Keep one shared application shell. Object packages supply content and supported capabilities, not shell markup, typography, navigation, or responsive behavior.
- Keep runtime DOM retained and stable. Prepare textures, atlases, scene state, lighting, weather, and other static work ahead of runtime.
- Runtime may decode and transport prepared state. It must not derive source data, geometry, charts, atlases, or scene assets.
- Select the canonical highest-density prepared assets once for each mount, independent of device DPR. Do not swap asset banks after the scene is mounted.
- Do not use runtime `clip-path`, CSS masks, filters, CSS gradients, blend modes, canvas, WebGL, or SVG scene rendering.
- Preserve source/provenance files beside each planet and keep prepared outputs reproducible from the checked-in inputs.
- Use source and runtime closure tests, object-package tests, router tests, and `OBJECTS`-derived browser conformance as proof. Do not duplicate those facts as declaration-only constants.
- Before calling an object ready, run `pnpm acquire:planets -- --verify-only`, `pnpm test`, `pnpm build`, and `pnpm test:browser`. Prove DPR 1 and DPR 2 in real Chrome.
