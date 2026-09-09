# cssEarth project contract

- Mount exactly one object scene at a time. Navigation entries navigate; they never coexist as rendered objects.
- Saturn is the accepted visual-quality reference. Shared input policy belongs in `site/runtime-policy.mjs`; browser conformance proves common interaction behavior. Keep object-specific rendering facts inside each object package. Do not fabricate fallback scenes for planned objects.
- Keep one open-ended `OBJECTS` registry and one generic object adapter. The Sun, planets, and future moons, dwarf planets, asteroids, or other bodies use the same object contract. The fixed eight planet ids are a reporting filter, not a second registry or adapter.
- Use one shared world camera and navigation contract for every prepared object. Menu membership never limits rendering; new object types extend prepared capabilities rather than introduce separate page-based scene owners.
- Keep one shared application shell. Object packages supply content and supported capabilities, not shell markup, typography, navigation, or responsive behavior.
- Keep runtime DOM retained and stable. Prepare textures, atlases, scene state, lighting, weather, and other static work ahead of runtime.
- Runtime may decode and transport prepared state. It must not derive source data, geometry, charts, atlases, or scene assets.
- Select the canonical prepared dataset once for each mount, independent of device DPR. Earth city-level paging may change the bounded resident set of that dataset's prepared pages and resolution levels; it must not generate geometry or imagery at runtime. Other object asset banks remain fixed after mount.
- Do not use runtime `clip-path`, CSS masks, filters, CSS gradients, blend modes, canvas, WebGL, or SVG scene rendering.
- Preserve source/provenance files beside each planet and keep prepared outputs reproducible from the checked-in inputs.
- Use source and runtime closure tests, object-package tests, router tests, and `OBJECTS`-derived browser conformance as proof. Do not duplicate those facts as declaration-only constants.

## Provenance and documentation

- Follow [the provenance and documentation contract](docs/provenance/CONTRACT.md) for source records, credits and test evidence. It adapts the cited PDS4 standards to the existing repository formats. PROVENANCE DOCUMENTATION maintains the shared instructions; contributors update the records affected by their change.
- For body work, use the checked-in [celestial skill](.agents/skills/celestial-skill/SKILL.md). Make the body README its source-and-evidence document: explain the datasets, processing, test results and known problems, with links to source details and original reports. Keep installation and common usage in shared repo guides.
- Keep each report tied to the version it tested. When reusing an old result, explain why it still applies to the new version.
