# Pleiades dust preparation

These TypeScript generators prepare the [Pleiades regional dust model](../../../../../src/objects/milky-way-pleiades-dust/README.md). Its README holds the sources, measured constraints, evidence and known problems.

## Model and inputs

- `column/` prepares the infrared column: registered AllWISE and Spitzer bands, compact-source removal, a common beam and a global heating-template fit. The preserved column is conditional on that heating prior, rather than a unique dust-mass measurement.
- `field/` distributes the column along registered Edenhofer profiles, applies luminosity-scaled radiation-pressure cavities and prepares stellar transmission. `source/depth-profiles.json` retains 32,657 native-extracted Float32 samples exactly; their widths include reconstruction uncertainty.
- `physics/` calculates inverse-square stellar illumination, Draine extinction/albedo/Henyey–Greenstein scattering and the published modified-MMP U = 1 Galactic field. Six incoming directions approximate diffuse shielding.
- `geometry/` places finite cloud representatives at emissivity-weighted depths using the fixed reference camera and display parameters in `source/parameters.json`.
- `atlas/` packs the foreground cells with four-pixel gutters, transparent-edge RGB dilation and exact lossless WebP. `panorama/` integrates the remaining Galactic-only light and feathers six expanded faces by normalized optical depth.

The foreground elements retain one position, image and illumination from every camera direction. The wide cirrus is a rigid panorama; its display radius approximates distant sky. The full density field retains its own coordinates for stellar transmission. The runtime uses the existing cloud-points and fixed-image volume renderers, with source-over composition.

## Restore, bake and install

From the repository root, the source mirror restores the numerical inputs declared in the regional manifest. The complete model can be rebaked without the original local research runs. Runtime setup and scientific source restoration are separate operations.

```sh
pnpm install --frozen-lockfile
pnpm setup:assets --object=milky-way-pleiades-dust
node packages/bake/cli/restore-source-inputs.mts --object=milky-way-pleiades-dust
node packages/bake/authoring/m45/dust/bake.mts --pilot
node packages/bake/authoring/m45/dust/install.mts --pilot
node packages/bake/authoring/m45/dust/bake.mts
node packages/bake/authoring/m45/dust/install.mts
```

The small bake uses the same producer and parameters, selecting two foreground cells and a single observer row for transmission; the panorama retains all six faces so its joins can be checked. Installation validates completion and immutable single-frame support before updating the inventory. Intermediate images, records and timing traces stay in ignored local storage. Publication follows the shared maintainer guide.

Re-extracting the native Edenhofer products requires the cached native radial/HEALPix row extracts and the healpy/NumPy environment used by `acquisition/edenhofer.mts`. Infrared archive acquisition belongs to `packages/telescope-cli/authoring/m45/wise.mts` and `spitzer.mts`; their calibration and fitting are distinct from rebaking the preserved registered column. `acquisition/named-star-table.mts --check` checks the adopted 136.7 pc bright-star plane against measured sky positions.

## Checks and limits

Focused tests cover atlas colors/encoding, panorama support and fixed-ray geometry, foreground selection and optical-depth window conservation. Renderer-state tests check retained element identity, positions and immutable lighting. These establish data and projection behavior, not hardware frame delivery.

The field does not uniquely determine mass or true thickness. Cavity grain and flow parameters are adopted. Fixed Earth-reference lighting and finite billboards approximate other viewpoints. Device measurements show a drag deficit, variable iPad coast slowdown and faint straight-edged dark boundaries in the native iPad Earth view; the regional README links the evidence.
