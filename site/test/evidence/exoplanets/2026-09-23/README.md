# Exoplanet and host-star limb bake — 2026-09-23

This is the follow-up to the [17-planet and nine-star baseline audit](../2026-09-22/README.md) in [PR #562](https://github.com/layoutit/css.earth/pull/562). It checks the selected physical limb treatment of every registered exoplanet and host star. The browser capture used the isolated checkout's Astro server at `127.0.0.1:4298`, not a production deployment.

## Adopted treatments

| Bodies | Count | Source and prepared result |
| --- | ---: | --- |
| Host stars | 9 | Each selects a source-bound quadratic profile and mounts a published black-alpha plate. The eight pre-existing published plates retain their hashes. TRAPPIST-1 now uses the modeled I+z coefficients in [Gillon et al. (2016), Extended Data Table 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC5321506/): `u1 = 0.65 ± 0.10`, `u2 = 0.28 ± 0.12`. The authors inferred these from theoretical stellar-atmosphere tables and used them as transit priors. They are not a resolved image or a direct limb measurement. The new plate's 1024 × 1024 pixels have maximum alpha 180, centre alpha 0 and transparent pixels outside the disc. |
| Lit exoplanets | 10 | Their adopted radii and spherical shape records define an opaque geometric silhouette. A prepared, phase-dependent Lambert lighting bank shades that shape. The recipe now names its `measurements.json#radiusKm` input and says explicitly that no atmospheric rim is inferred. No separate emissive plate is mounted. |
| Emissive exoplanets | 7 | Each already mounts one transparent limb plate per lens, sized to the source-radius sphere. The recipe now identifies `measurements.json#radiusKm` and states that no off-limb or radial-brightness source is selected. These are deliberate geometric limbs, not claims of a glowing atmosphere. The seven planets have eight plate files because WASP-43 b has two lenses. Their unchanged published alpha maxima remain zero. |

The planet radii and their paper citations are in each package's `source/measurements.json`. [The radius test](../../../../../tests/objects/unit/exoplanet-radius.test.mts) checks those values against the scene, shape and world scale. [The limb coverage test](../../../../../tests/objects/unit/exoplanet-limb-coverage.test.mts) checks the two planet preparation paths and all nine star law bindings. The [paper survey](../2026-09-22/README.md#source-backed-limb-opportunity) examines atmospheric and phase-curve measurements; it does not turn wavelength-dependent transit depths into a broadband emission halo.

The existing eight star recipes had called their plates transparent despite nonzero published alpha. Their metadata now describes the black-alpha quadratic darkening. The shared prepared report now distinguishes a theoretical atmosphere model from a transit fit. TRAPPIST-1's lens and reader text label its I+z profile as modeled and keep Gaia DR3 as the colour source.

## Bake and checks

- The TRAPPIST-1 star's newly baked plate and prepared content are pinned in its tracked inventory. Publication verified all 19 inventory keys live at the runtime asset origin; seven new content-addressed files were uploaded in the first pass, then one changed reader-text file after the model label was added.
- `node --test tests/objects/unit/exoplanet-limb-coverage.test.mts tools/objects/observation/stellar-photometric-color.test.mts` passed. Three older spectral tests skipped because unrelated ignored WASP/HD catalogue inputs were absent when that command ran; the new TRAPPIST-1 model test ran and passed. `pnpm typecheck:tests` and `node tools/prepare/prepare-facilities.mts --catalog-only` passed.
- The eight existing host-star authoring paths were rerun after their metadata correction. A full WASP-39 b planet rebake produced the same inventory bytes. The remaining planet changes only clarify the adopted geometric limb in source recipes, so their existing published plates and lighting banks were retained.
- Chrome for Testing opened `/trappist-1/` with the modeled plate and reader label. The route mounted without a browser error. The captured center is Gaia colour and pixels toward the edge are darker. [Inspect the browser capture](images/trappist-1-modeled-limb.png).

The full authoring provenance pass in this selective checkout still stops at the unrelated missing M31 image-layer bank. Its selected 26 object provenance files regenerated with `--objects-only`, and the prepared source catalogue passed its catalog-only check. The raw WASP-43 b Zenodo archive returned HTTP 403 on a fresh source restore, so no new planet imagery was derived from it for this metadata-only change.
