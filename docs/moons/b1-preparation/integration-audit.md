# B1 integration and preparation audit

Inspected read-only at merged commit `7b289887ee03e040b981f6aaff25390d1e17ca9c` on 2026-09-08. The old dirty main checkout was not used as implementation state. This document owns no code change, package creation, source download, build, Git mutation or checkout decision.

**Most rendering work reuses the existing authored `solid-observation-body` / `radial-terrain` path.** B1 needs 26 new package integrations and 26 qualified parent-relative orbit records. The concrete shared gaps found are Hiʻiaka title validation, missing parent astronomy data for Patroclus, and physical/photometric context for the asteroid parents. A published mutual-orbit source that cannot go through the existing Horizons fitter may additionally need a small source-data adapter; that is a source-closure decision, not a reason to build another renderer.

## Cohort and integration identity

Each row requires its own `src/planets/<id>/`, `site/pages/<id>.astro`, registry entry and body tests. IDs below are proposed ASCII package IDs; display names retain the reviewed spelling. JPL numbers for Saturn are from the completed review. Uranian 716–719 are the catalog identifiers; exact request responses still need to be pinned. No companion code is invented from its primary's asteroid number.

| Proposed ID | Display name | Parent | Orbit intake | Shape branch |
|---|---|---|---|---|
| paaliaq | Paaliaq | saturn | 620, center 500@699 | Published elongation lower bound; multiple lightcurve extrema limit ellipsoid interpretation |
| tarvos | Tarvos | saturn | 621, center 500@699 | Lower-bound ellipsoid; multiple extrema |
| ijiraq | Ijiraq | saturn | 622, center 500@699 | Lower-bound ellipsoid |
| suttungr | Suttungr | saturn | 623, center 500@699 | Lower-bound ellipsoid; two/three extrema |
| mundilfari | Mundilfari | saturn | 625, center 500@699 | Lower-bound ellipsoid; limited high-phase sequence |
| skathi | Skathi | saturn | 627, center 500@699; legacy Skadi alias | Lower-bound ellipsoid |
| erriapus | Erriapus | saturn | 628, center 500@699 | Lower-bound ellipsoid; no invented neck |
| thrymr | Thrymr | saturn | 630, center 500@699 | Lower-bound ellipsoid; tentative spin |
| bebhionn | Bebhionn | saturn | 637, center 500@699 | Lower-bound ellipsoid |
| bergelmir | Bergelmir | saturn | 638, center 500@699 | Lower-bound ellipsoid |
| bestla | Bestla | saturn | 639, center 500@699 | Lower-bound ellipsoid; partial ecliptic pole constraint is not a full ICRF pole |
| fornjot | Fornjot | saturn | 642, center 500@699 | Lower-bound ellipsoid; competing periods |
| hati | Hati | saturn | 643, center 500@699 | Lower-bound ellipsoid; retain the reviewed period source discrepancy |
| hyrrokkin | Hyrrokkin | saturn | 644, center 500@699 | Lower-bound ellipsoid; three maxima |
| loge | Loge | saturn | 646, center 500@699 | Weak lower bound and tentative spin |
| skoll | Skoll | saturn | 647, center 500@699 | Lower-bound ellipsoid; tentative solution |
| greip | Greip | saturn | 651, center 500@699 | Lower-bound ellipsoid; alternative period |
| tarqeq | Tarqeq | saturn | 652, center 500@699 | Lower-bound ellipsoid |
| caliban | Caliban | uranus | 716, center 500@799 | Photometry/size constrained ellipsoid family |
| sycorax | Sycorax | uranus | 717, center 500@799 | Photometry/thermal-size constrained ellipsoid family |
| prospero | Prospero | uranus | 718, center 500@799 | Ellipsoid family; single/double-peaked period ambiguity |
| setebos | Setebos | uranus | 719, center 500@799 | Ellipsoid family; single/double-peaked period ambiguity |
| hiiaka | Hiʻiaka | haumea | Select interacting-satellite solution and exact center/frame | Inferred triaxial semi-axes with uncertainty; not full diameters |
| squannit | Squannit | moshup | Select KW4 Beta relative orbit/attitude release and identifiers | Actual Beta OBJ, source-preserving mesh simplification |
| romulus | Romulus | sylvia | Select Sylvia-system solution; distinguish primary/system barycenter | Projected ellipse with assumed third axis or ellipsoid family |
| menoetius | Menoetius | patroclus | Select binary mutual-orbit/Lucy route; resolve barycenter versus primary center | Occultation/lightcurve inferred ellipsoid |

All 26 are absent from the inspected registry and generated satellite fit list. The four companions need source-defined orbit intake, not a mechanically constructed `500@<asteroid number>` request. Patroclus is absent from `AsteroidId`, `ASTEROID_IDS`, `BODIES`, the asteroid generator and application registry. Adding an astronomy parent record is required; adding a 27th standalone rendered package is **not** implied by B1.

## Exact owners and required changes

| Concern | Source owner at inspected commit | B1 action |
|---|---|---|
| Registry / lazy loader | `site/objects.mjs:183`; `site/object-schema.mjs`; `site/packaged-object-runtime.mjs` | Add 26 descriptor imports and `object(id, displayName, 'satellite', …)` entries with `loadPackagedObject`. Carry generated `properties.worldFrame`. Keep one `OBJECTS`; do not add a moon-only runtime registry. |
| Thin routes | `site/pages/kiviuq.astro` | Add one route per ID using `PlanetLayout`, `PreparedObjectHead`, `PreparedObjectPanel`, prepared JSON and generated surface CSS. No copied shell/controller. |
| Astronomy identity and physical scale | `packages/astronomy/src/bodies.ts:23,38,65,343` | Add physical/parent records for all 26; `SatelliteId` derives from generated records. Add Patroclus to asteroid identity/list/data generation. Mean/display radius must remain distinct from shape axes. Zero GM means omitted mass, never measured zero. |
| Parent-relative orbit generation | `packages/astronomy/tools/generate-satellites.mjs:86–170,293,476`; `tools/lib/horizons.mjs`; `tools/lib/fit-position-correction.mjs` | Add exact target/center/parent records with source-specific interval/cadence. Fit only the selected new bodies, retaining existing records. Do not clone Albiorix's 512-term cosine correction or cadence as a default. Inspect residuals before selecting corrections. |
| Generated satellite records | `packages/astronomy/src/data/satelliteElements.data.ts` and family chunks | Regenerate through `generate-satellites.mjs` / `write-record-sections.mjs`. Never hand-edit generated elements. New parents may create new family chunks. |
| Independent vector fixtures | `packages/astronomy/tools/fetch-fixtures.mjs:114–124`; `packages/astronomy/src/__fixtures__/horizons.moons-and-small-bodies*.ts` | Add body/center entries and independently sampled epochs inside each actual fit interval. Generated fixture files are not hand-authored. Companion primary-centered vectors must be checked independently of any barycenter translation. |
| Orbit evaluation | `packages/astronomy/src/satellites.ts:77–115`; `solarSystem.ts`; `periodicCorrection.ts` | Existing generic satellite records evaluate positions/velocities and can apply a declared binary-companion translation. Reuse only when its mass/center semantics match the new source. An unpublished/unsupported Horizons target needs a reproducible literature/SPK intake adapter to this generic record, not fabricated osculating elements. |
| Body orientation | `tools/objects/authored-rotation.mjs`; package `source/preparation/rotation.json` | Reuse display-orientation, observed-pole or measured-rotation schema according to the evidence. Pin the rotation recipe in `object.json`. Unknown pole/phase stays explicit. |
| Shared prepared epoch | `tools/prepare-solar-geometry.mjs:33–35,98–150,168–183`; generated `src/platform/solar-geometry.mjs` | Recompute new positions, matrices, Sun/orbit directions and provenance at JD TT 2461286.5. It already handles asteroid/dwarf parents. Source center, physical mass and frame assumptions must agree before this step. |
| Solid preparation | `tools/objects/prepare-authored.ts:136`; `tools/objects/terrestrial-layers/index.mjs`; `solid-scene.mjs` | Reuse `solid-observation-body`, `shape.kind='radial-terrain'`, one truthful model lens and existing lighting/picking. New data, not 26 new preparers. |
| Model sampling / mesh | `tools/objects/terrestrial-layers/obj-shape.mjs`; `radial-terrain.mjs:23–122`; `radial-meshoptimizer.mjs` | Use checked radius tables for ellipsoids and the actual OBJ for Squannit, with `primitive:'u'` and `simplification.method:'source-meshoptimizer'`. Select face/error budgets from source/visual evidence. |
| Source closure / restoration | `tools/objects/operations.ts`; `operations-acquisition.ts`; `src/platform/source-manifest.mjs`; package `source/manifest.json` / `source/preparation/acquisition.json` | Pin complete source trees, hashes, bytes, consumers, terms and generated-intermediate lineage. Required inputs must be checked in or restored exactly. Do not use an article URL as a direct download route for an authored `.tab`. |
| Content / controls | Package `source/content/object.json`; `tools/objects/content/`; `site/components/PreparedObjectPanel.astro` | Expose assumptions beside the selected model, including scale, lower bound, third axis, unknown pole and arbitrary phase. Measured period in facts does not turn display motion into a measured current attitude. |
| Titles | `tools/prepare-planet-title-sources.mjs:42–57`; `tools/prepare-planet-title-sources.test.mjs`; `site/test/prepared-titles.test.mjs` | Regenerate names from registry; the current ASCII-only regex rejects **Hiʻiaka**. Extend generic label validation for the actual supported Unicode character and verify the pinned Inter glyph. Keep package ID `hiiaka` separate from display text. |
| Markers / navigation | Package `source/preparation/navigation.json`; `radial-snapshot.mjs`; `tools/prepare-navigation.mjs:157–180`; `site/prepared-navigation-markers.mjs`; `site/planet-search-objects.mjs` | Generate context images from the same prepared shape/missing-data treatment, then marker atlases/manifests. Search/navigation derives from `OBJECTS`. Parent sprites and context need source-aware treatment; do not fabricate a Patroclus surface. |
| Physical system context | `src/platform/prepare-planetary-system.mjs:181–227,319–397`; `tools/objects/prepare-spatial-context.ts:39–69` | Parent-centered asteroid/dwarf satellites are already supported. Resolve parent catalog, orbit-center and marker photometry gaps listed below. Preserve single active scene. |
| Publication / runtime closure | `tools/objects/publication.mjs`; `tools/prepare-object-json.mjs`; `tools/setup.mjs`; `tools/run-implemented-planets.mjs` | Generate prepared descriptor/hash, assets and CSS; assemble declared runtime files and verify fresh setup uses the same pins. Do not hand-write prepared world frames or asset manifests. |

Paths inside the astronomy tools row are relative to `packages/astronomy/` where applicable. `packages/astronomy/AGENTS.md` requires dependency-free renderer-neutral math, TT epochs, ICRF outputs, generated data through generators, and independent numerical guards. The application handles asteroid/dwarf-parent context through its preparers; the astronomy `solarSystemFrameSpecs` eight-planet loop is not itself evidence that all small-body frames need a wholesale rewrite.

## Reuse the examples by capability

### Constraint models: Kiviuq and Albiorix

Read `README.md`, `object.json`, `source/measurements.json`, `source/preparation/{terrestrial,rotation,navigation,acquisition}.json`, `source/manifest.json` and `tests/objects/unit/<id>/source.test.mjs` for both examples.

Their geometry is a **checked-in authored radius table**. The metadata records `b=c=R/cbrt(q)`, `a=q*b`, the angular sampling and the uniform-reflectivity lower-bound interpretation. The current shared `ellipsoid-geometry.mjs` is an affine **axisymmetric** latitude-band helper; it is not a three-axis sampler or a ready lower-bound-model generator. B1 can retain small checked tables as reproducible source inputs. If authoring 25 tables warrants automation, add one parameter-driven preparation utility with source-pinned measurements and analytic-axis/volume tests; do not add per-body scripts or claim that generic helper already exists.

Kiviuq's selected model uses 480 prepared facets, a neutral image whose every pixel is the declared no-data value 160, and the shared missing-coverage grid. Its principal axes, selected ratio, volume convention, mesh closure and independent orbit holdouts are tested. These are capability examples: B1 must not inherit its radius, `q`, 210-m simplification error, arbitrary camera, orbit fit or license conclusion. The complex or ambiguous lightcurves in the table above remain limiting evidence; an ellipsoid does not become a recovered shape merely because a mesh closes.

`cssearth-display-orientation@1` returns zero physical spin rate and an arbitrary display meridian. `cssearth-observed-pole@1` requires a complete ICRF pole and period but retains arbitrary phase. Bestla's partial ecliptic latitude is insufficient by itself for that schema. Hiʻiaka or other bodies with a measured photometric period but unknown pole should keep the period as content unless a full orientation source is qualified. User interaction speed is not an ephemeris.

### Squannit: use the native Beta source mesh

Moshup's recipe demonstrates `wavefront-obj` and source-preserving simplification, but **`kw4a.obj` is Alpha and must not be used for Squannit**. The reviewed Beta OBJ and its release labels are the intake; read units, indexing, axes, version and dimensions before pinning expected counts. `obj-shape.mjs:295` exposes native positions/indices, and `radial-terrain.mjs:81` simplifies those positions before UV sampling when `source-meshoptimizer` is selected. This merged route does retain source topology for simplification; the older skill-map warning about a ray-only OBJ route does not describe this selected branch.

Use neutral missing imagery on the Beta shape unless a separate observation is actually qualified. A radial-height diagnostic would be relative to a disclosed reference sphere, not a geoid or photographed surface. Beta's libration/phase limits remain source-owned; copying Alpha's rotation or an exactly synchronous fixed attitude is invalid. The existing linear/measured orientation schemas cannot represent a time-dependent libration series; if B1 needs that prediction, extend a generic authored orientation capability with source interval/tests, otherwise use an explicitly arbitrary display phase and retain the scientific limit.

## Concrete gaps to resolve before an expensive batch bake

1. **Hiʻiaka title rejection:** `createPlanetTitleSource` accepts only ASCII letters/digits and a narrow separator list. This is a demonstrated small shared change, with a Unicode-name regression and glyph check.
2. **Asteroid-parent gravity:** `BODIES.moshup.gravitationalParameterKm3PerS2` is currently zero. `prepare-solar-geometry.mjs:132–135,176–183` derives the displayed satellite ellipse from the summed parent/child GM. Resolve a sourced system/individual mass interpretation for Squannit; zero omitted mass is not a usable gravitational parameter. The same check applies to the new Patroclus/Menoetius records and any published system masses.
3. **Asteroid-parent photometry:** `preparePlanetarySystem` automatically includes an asteroid satellite's parent, but its `GEOMETRIC_ALBEDO` table currently lacks Moshup, Sylvia and Patroclus. The later marker flux/point preparation reads that value directly. Add source-backed context albedos or a generic explicitly qualified non-photometric marker policy; otherwise new Squannit/Romulus/Menoetius context will feed undefined values into flux/point calculations. Existing parent scenes have not exercised this exact child-observer path.
4. **Patroclus catalog dependency:** add source-backed parent radius/GM/heliocentric elements and independent reference data through `bodies.ts` and `generate-asteroids.mjs`. The asteroid context path computes its position directly from these elements and can represent a parent without inventing a standalone surface. If Patroclus is added to an explicit universe/world-context source, `prepareSpatialContext` also requires its prepared solar geometry and parent state; implement the minimal generic dependency support there rather than silently creating another rendered package. A sourced child-owned `parentMarker` is supported by `solid-scene.mjs:99–108`; absent that, the existing generic point is context, not a photographed parent.
5. **Companion orbit delivery:** the fitter currently acquires Horizons osculating elements. Hiʻiaka, Squannit, Romulus and Menoetius have reviewed scientific routes but no selected B1 numeric orbit intake yet. Pin available target/center responses or a documented scientific solution, establish TT/TDB and frame conversions, and add a reproducible adapter only if the source demands it. Do not label copied catalog means or an arbitrary ellipse as a tested fit.
6. **Radius/extent contract:** every reference scale must agree across astronomy, authored geometry and generated world frame, while actual triaxial extrema must govern picking/framing. Resolve whether the chosen radius is measured, thermal, projected or an assumed equal-volume convention. The source simplifier's numerical error is not shape-measurement uncertainty.

## Preparation order and qualification map

The owner should first choose the safe execution checkout and close the 26 source identities. This audit is not authorization to bake in the old dirty main checkout.

1. Finalize source-pinned constraints/models, parent data, exact orbital centers/windows and orientation interpretation for all 26. Resolve the title and asteroid-parent context gaps. Add authored package data, registry/routes and source manifests in the selected checkout.
2. Generate selected astronomy fit records and independent vector fixtures. Build astronomy and regenerate shared solar geometry. Do not hand-edit `src/platform/solar-geometry.mjs`; its fixed epoch owns the generated matrices and world placement.
3. Prepare selected objects through the shared entry point. `pnpm prepare:planets -- --object=<id>` runs the shared titles/charts steps and then navigation; `tools/prepare-planets.mjs:215` guards a single `.local/preparation/running.lock`. Do not launch multiple independent preparation writers in one checkout. Shared data/pins and parent dependencies mean parallel workers should own disjoint authored data, with one coordinated preparation/publication pass.
4. Verify source restoration and prepared runtime installation separately. `pnpm acquire:planets -- --verify-only` checks source pins; `setup:assets --object=<id>` installs prepared outputs. Successful runtime installation does not prove the source can be re-prepared. Keep checked authored tables versus restorable external models explicit in acquisition metadata.
5. Run body tests via `tests/objects/unit/<id>/` and browser profiles via `tests/objects/browser/<id>/browser-profile.mjs`. Extend existing independent axis/ratio/volume, missing-coverage, topology and held-out vector checks with each body's actual source anchors. For Squannit test Beta identity, units, bounds/volume and silhouette after simplification. Include primary-versus-barycenter, period ambiguity and assumed orientation checks where relevant.
6. Existing generic gates cover registry/package/route contracts (`site/test/object-package-contract.test.mjs`, `object-navigation.test.mjs`, `navigation-router.test.mjs`), title preparation, authored source restoration, world frames and shape preparation. Add focused regressions only for the demonstrated shared changes. Reuse one adapter, one active scene and retained stable DOM.
7. Required final commands remain `pnpm acquire:planets -- --verify-only`, `pnpm test`, `pnpm build`, `pnpm test:browser`. At this commit **`pnpm test` does not include `test:planets` or `test:preparation`**, and **`test:browser` is DOM cleanliness**, so run the relevant body/preparation tests and `pnpm test:browser:conformance` as well. The conformance runner accepts `<base-url> <id>` and defaults to real Chrome; its full selected-body path covers DPR 1/2. Its density-only mode is not full interaction proof.

Every new body needs real Chrome DPR 1 and 2 evidence for the actual prepared bytes: mounting/navigation, source framing and close zoom, native-triangle drag/picking, both supported lighting states, no-data treatment, stable retained DOM and canonical assets independent of DPR. Count the completed B1 result as 26 new moons only when all 26 pass their source and integration claims. Capture/build locations and disk projections must be reported before outputs expected to exceed 1 GiB; do not start such materialization under 25 GiB free.

## Audit boundary

No existing result was requalified. No companion ephemeris, mass, albedo or model payload was fetched. The source survey supplies feasibility and limits; this document identifies the exact implementation owners and currently demonstrable integration gaps. Model-only B1 packages do not depend on B4 chart implementation unless a scope decision intentionally adds it.
