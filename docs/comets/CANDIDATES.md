# Further comet intake

The six comet scenes include 67P, Hartley 2, Tempel 1, the completed PDS Wild 2 model, Halley's historical model and Tuttle's two inferred contact models. The original archive survey was made on 8 September 2026; the Tuttle comparison was added on 9 September. An unresolved candidate is not a claim that usable data does not exist.

## Wild 2: completed PDS model selected

[PDS v2.1](https://pdssbn.astro.umd.edu/holdings/sdu-c-navcam-5-wild2-shape-model-v2.1/dataset.shtml) provides observed-only and completed plate models. The full model uses the archive's fitted ellipsoid and joining faces for unseen terrain, with explicit provenance flags. It now supplies Wild 2's closed 992-leaf scene. The viewer describes the estimated far side; no photographic or observed-terrain claim is made for it. See [the completion record](WILD2-COMPLETION.md).

## Borrelly: image-frame terrain, not a closed nucleus

The [DS1 PDS catalogue](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/catalog/dataset.cat) provides USGS and DLR stereo elevation models for the visible, illuminated side. Their coordinates are a local image-related frame; heights are relative to a reference plane. The [USGS label](https://pdssbn.astro.umd.edu/holdings/ds1-c-micas-5-borrelly-dem-v1.0/data/usgsdem.lbl) specifies a 16 m grid with missing positions omitted and includes surface normals. The catalogue reports roughly 85 m mean differences between the two independently processed models.

A useful implementation would preserve that terrain footprint, datum and observed framing. Treating these heights as global nucleus radii would be incorrect. This partial terrain presentation remains unresolved and is not registered.

## Halley: historical model selected

The [specific PDS4 Halley label](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/1682q1halley.xml) describes Stooke's Giotto/Vega limb-and-terminator model: 2,701 longitude/latitude/radius samples, 5° spacing, kilometers, east-positive longitude. The coordinate reference axis follows the long axis, with north toward the larger end; it must not be substituted for a simple spin pole.

The source estimates absolute errors around 500–1,000 m and warns that depressions may be exaggerated. Its [bundle description](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/document/bundle_description.txt) also warns that the model origin need not be the center of figure. The selected view is explicitly labelled as a highly uncertain historical model, with neutral material, a preserved local frame and an illustrative fixed attitude. The exact table, label and hashes are checked in under `src/planets/comet-1p/source/`. See [Halley qualification](HALLEY.md).

## Tuttle: Hubble/Spitzer default and Arecibo alternative

[Groussin et al. (2019)](https://arxiv.org/abs/1911.04897) compares Hubble and radar contact-body models using Spitzer thermal observations. The selected model preserves the Hubble 7:3 lobe ratio and applies the square root of the fitted thermal flux scale. Its two smooth spheres represent inferred shape; no resolved terrain is available.

[Harmon et al. (2010)](https://echo.jpl.nasa.gov/asteroids/harmon.etal.comet.tuttle.pdf) provides a credible alternative with two prolate lobes. That family is included as a separate Arecibo dataset at the same physical scale. Hubble/Spitzer remains the default because it fits the thermal measurements better. The radar dimensions are taken directly from the 2010 paper without Spitzer rescaling; its axes are aligned for comparison, with no unique radar pole claimed. Neither family is a measured global surface mesh. Unresolved Spitzer imagery and spectra do not qualify another surface texture. [The Arecibo comparison](TUTTLE-ARECIBO.md) gives the current numerical checks and delivery evidence.
