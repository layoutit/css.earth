# Further comet intake

The original seven comet scenes include 67P, Hartley 2, Tempel 1, the completed PDS Wild 2 model, Halley's historical model, Tuttle's two inferred contact models, and Borrelly's observed terrain. The original archive survey was made on 8 September 2026; the Tuttle comparison was added on 9 September. An unresolved candidate is not a claim that usable data does not exist.

## 67P: regions and geological features selected

[Thomas et al. (2018)](https://doi.org/10.17632/2845znt54k.1) releases 26 region IDs on the SHAP7 source mesh. [ESA-AURORA (2021)](https://doi.org/10.5270/esa-kokoti7) supplies geological paths and feature locations mapped in 17 regions. Both now use the current 1,000-triangle 67P scene as Regions and Geology datasets. The [selection and qualification record](67P-GEOLOGY.md) records the bounded 3D registration, unsupported coverage, source credits and excluded flat projections.

## Wild 2: completed PDS model selected

[PDS v2.1](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/dataset.shtml) provides observed-only and completed plate models. The full model uses the archive's fitted ellipsoid and joining faces for unseen terrain, with explicit provenance flags. It now supplies Wild 2's closed 992-leaf scene. The viewer describes the estimated far side; no photographic or observed-terrain claim is made for it. See [the completion record](WILD2-COMPLETION.md).

## Borrelly: terrain, estimated completion and registered photography selected

The [DS1 PDS catalogue](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/catalog/dataset.cat) provides USGS and DLR stereo elevation models for the visible, illuminated side. Their coordinates are a local image-related frame; heights are relative to a reference plane. The [USGS label](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/data/usgsdem.lbl) specifies a 16 m grid with missing positions omitted and includes surface normals. The mapping paper infers about 85 m RMS uncertainty per model under its stated assumptions; this is not our registration's measured error.

The included scene preserves those terrain footprints and datums in separate USGS and DLR banks. MICAS orthophotography is registered through its original XYZ cubes; Height retains the USGS image-plane datum, and Difference compares only overlapping terrain after a documented registration. The unobserved side and internal gaps receive an explicitly estimated completion with the shared missing-data grid. [Borrelly](BORRELLY.md) records source qualifications, alignment sensitivity and browser evidence.

## Halley: historical model selected

The [specific PDS4 Halley label](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/1682q1halley.xml) describes Stooke's Giotto/Vega limb-and-terminator model: 2,701 longitude/latitude/radius samples, 5° spacing, kilometers, east-positive longitude. The coordinate reference axis follows the long axis, with north toward the larger end; it must not be substituted for a simple spin pole.

The source estimates absolute errors around 500–1,000 m and warns that depressions may be exaggerated. Its [bundle description](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/document/bundle_description.txt) also warns that the model origin need not be the center of figure. The selected view is explicitly labelled as a highly uncertain historical model, with neutral material, a preserved local frame and an illustrative fixed attitude. The exact table, label and hashes are checked in under `src/planets/comet-1p/source/`. See [Halley qualification](HALLEY.md).

## Tuttle: Hubble/Spitzer default and Arecibo alternative

[Groussin et al. (2019)](https://arxiv.org/abs/1911.04897) compares Hubble and radar contact-body models using Spitzer thermal observations. The selected model preserves the Hubble 7:3 lobe ratio and applies the square root of the fitted thermal flux scale. Its two smooth spheres represent inferred shape; no resolved terrain is available.

[Harmon et al. (2010)](https://echo.jpl.nasa.gov/asteroids/harmon.etal.comet.tuttle.pdf) provides a credible alternative with two prolate lobes. That family is included as a separate Arecibo dataset at the same physical scale. Hubble/Spitzer remains the default because it fits the thermal measurements better. The radar dimensions are taken directly from the 2010 paper without Spitzer rescaling; its axes are aligned for comparison, with no unique radar pole claimed. Neither family is a measured global surface mesh. Unresolved Spitzer imagery and spectra do not qualify another surface texture. [The Arecibo comparison](TUTTLE-ARECIBO.md) gives the current numerical checks and delivery evidence.

## 137P, 143P and 162P: published proportions selected

The public [Donaldson thesis](https://era.ed.ac.uk/items/cf7f5ebf-4f32-4f86-95d2-b8dd2e37c8ad) gives physical axis ratios and spin solutions for these three nuclei. Original convex mesh downloads were not found. The additions therefore expose smooth, explicitly labeled approximations, sized with SEPPCoN thermal radii and covered by the shared missing-imagery grid. They do not claim recovered terrain or photographic texels. [The qualification record](LIGHTCURVE-SHAPES.md) distinguishes alternative solutions and the scale convention.

10P, 169P and 172P remain deferred: the thesis does not recover unique shape and spin solutions for them. A catalog entry alone is insufficient to choose their geometry.
