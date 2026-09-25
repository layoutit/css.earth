# volume-viewer

Retained volume scenes, camera control and inspection through an injected renderer. This is a private workspace package; it is not published.

```text
src/
  scene/           Retained lifecycle and prepared material resources
  camera/          Shared framing, rotation and projected points
```

Dependencies: `@cssearth/bake/volume`; host-provided renderer operations. Consume explicit package exports rather than another package’s source paths.

Run `pnpm --filter @cssearth/volume-viewer typecheck` from the repository root after installing dependencies. The lab command runner discovers tests beside package owners.

Scene constructors require a per-instance backend and a path resolver. The lab adapters bind the canonical CSS renderer, camera publication, resource validators and local asset URLs. There is no default repository root or mutable renderer registration in this package.

- `scene/compiler-viewer` owns pinned resource loading, retained materials, compiler stars and disposal.
- `scene/shape-cloud-viewer` and `scene/joint-fit-viewer` own prepared scene lifetimes. The shape backend supplies the full host result validator; joint result validation uses the canonical core contract.
- `scene/inspection-banks`, `camera/inspection-camera`, `scene/catalogue-stars` and `scene/image-plane` own reusable inspection rendering. The host retains subject discovery, scientific catalogue validation, saved controls and image selection.
- Renderer backends own CSS renderer selectors, mounting, publication and projection. The viewer never reconstructs scientific fields or prepared geometry.

Ownership changes were checked against existing prepared outputs: compiler material switching, archived shape/joint views, legacy camera and saved overlay controls, and all 943 prepared catalogue stars. Cold replay gates remain explicit opt-in checks; browser checks consume existing prepared assets.
