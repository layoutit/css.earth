# Choosing destinations to explore

The Solar System's default captions guide visitors toward useful content.
The Sun and major planets remain orientation anchors. Prepared observation
imagery promotes a destination automatically; `properties.catalog.featured`
can also recommend a reviewed package. These are discovery choices, not a
scientific ranking. Search, category browsing and direct links retain all
registered objects.

## Illustration models

**Illustration models** starts off in Settings. It excludes approximate
stand-ins from the surrounding world and minimap, including their circles,
labels and orbits. Selecting one explicitly still opens its scene and preserves
its selected marker. Turning the setting on admits those bodies again.
The preference survives navigation within the app; a new session starts off.

This setting concerns the representation of the body, not whether it has a
photographic texture. Body-specific measured or reconstructed meshes remain
eligible without imagery: Pallas, Psyche, Kleopatra, Squannit and the 2001 SN263
radar meshes are examples. The separate asteroid settings still control
unfeatured asteroid crowding.

Approximate stand-ins include analytic spheres and ellipsoids that illustrate
size or axis constraints, approximate envelopes in place of an original shape
solution, and shared invented nucleus meshes. These can be source-backed
approximations without being resolved terrain meshes.

- [DeeDee](../src/objects/deedee/README.md) illustrates a thermal size estimate.
- [Aegaeon](../src/objects/aegaeon/README.md) uses an analytic approximation of
  reported axes, with no mapped surface texels.
- [Hale–Bopp](../src/objects/comet-c1995-o1/README.md) uses a shared illustrative
  nucleus, rather than a measured shape.
- [Pallas](../src/objects/pallas/README.md) uses the released MPCD reconstruction;
  its neutral surface and shape-derived elevation do not make it an illustration.

The current package declarations identify 105 approximate-only destinations.
Their result rows and selected cards say **Illustration only**. Body-specific
meshes without observation imagery say **Shape only**. These labels describe
available content, not an uncertainty estimate or a qualification verdict.

## Prepared promotion

`catalog.illustrationLenses` names a package's approximate stand-in datasets.
It is not a permanent blacklist of object identities. When replacing an
approximation with a body-specific mesh, remove that dataset from this list as
part of the package's source interpretation update.

`pnpm prepare:catalog` derives discovery from exposed `prepared/controls.json`
lenses and their raster recipes. It writes the ignored
`site/prepared-object-discovery.json` projection consumed by the single `OBJECTS`
registry. Runtime reads these booleans; it does not inspect source images or
generate assets.

A prepared observation lens makes the destination visible and featured without
changing a second promotion flag. Downloaded candidates absent from the prepared
controls do not count. Modeled observation textures, declared illustration
lenses, GLB base-color illustrations, shape views and shape-derived elevation
do not count as imagery. Partial photographic coverage does count; its gaps and
interpretation remain the dataset panel's responsibility. Removing the prepared
imagery restores the approximation gate when only that stand-in remains.

[Itokawa](../src/objects/itokawa/README.md),
[Ryugu](../src/objects/ryugu/README.md) and
[67P](../src/objects/comet-67p/README.md) illustrate useful observation datasets
with distinct limitations. Neither lens count nor source count measures quality.
New preparation adapters must extend the observation classification and its
tests when introducing a new representation.

## Stable priority

Selected, hovered and explicitly highlighted labels retain priority. Other
labels use fixed tiers: orientation anchors, featured destinations/major moons,
then ordinary objects. Clear placements survive within a tier through drag,
inertia and rest. A lower-tier survivor cannot reserve a slot ahead of a newly
visible higher-tier destination. Existing limits of 24 desktop and 12 compact
captions, panel occlusion and minimap flight freezing remain in place.

Focused checks cover default exclusion, opt-in visibility, category independence,
mesh-only counterexamples, imagery promotion/demotion, partial coverage, setting
lifetime and priority without motion-dependent reordering.
