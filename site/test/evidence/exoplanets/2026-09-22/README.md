# Exoplanet radius and route check — 2026-09-22

Checked on branch `fix/exoplanet-coverage-evidence`, subsequently rebased onto `4533674a80`, with the radius, source-credit and inventory changes in this pull request. The Chrome checks used the isolated checkout's Astro server at `127.0.0.1:4298`; this was not a production deployment.

## Source and package checks

- `node --test site/test/object-systems.test.mts tests/objects/unit/exoplanet-radius.test.mts`: 21 passed. The radius check covers all 17 registered exoplanet scenes and compares each source measurement with its scene radius, shape radius and world scale. Its K2-18 b anchor independently converts the 2.610 Earth radii in [Benneke et al. (2019), Table 2](https://arxiv.org/html/1909.04642v2) to 16,646.9 km using the package's stated Earth-radius convention. The system check now includes Beta Pictoris b, c and d.
- `CSSEARTH_TEST_OBJECTS=hd-209458b,k2-18b,kepler-186f,kepler-452b,wasp-39b node --test tests/objects/unit/runtime-package.test.mts`: 10 passed. This checks the five prepared runtime definitions and their retained-tree toggle behavior; it does not measure scientific accuracy.
- `pnpm typecheck:tests`: passed after the required pinned prepared JSON was restored into the isolated checkout.
- `node tools/prepare/prepare-facilities.mts --catalog-only`: passed and checked the source catalogue and 1,874 cited facts after the affected body provenance was regenerated.
- `pnpm --filter @cssearth/engine exec vitest run --root ../../src/renderers/css universe/prepared-world-context.test.ts --exclude '**/preparation/**'`: 122 passed after the Sun context was regenerated and republished on current main.
- `node tools/assets/publish-runtime-assets.mts --object=hd-209458b --object=k2-18b --object=wasp-39b`: published 17 new content-addressed files and verified all 147 inventory keys live. A clean temporary destination then downloaded all 147 files with byte and SHA-256 checks (`147 downloaded, 0 reused, 0 skipped`). Kepler-186 f and Kepler-452 b used their existing pinned inventories; neither was rebaked.

## Browser observations

Chrome for Testing 154 opened each direct route at 1280 × 720 CSS pixels and device pixel ratio 1. Each view settled with its interactive scene mounted, a factsheet radius and zero console errors. The three reported warnings per route concerned preloaded lighting resources that were not used immediately.

| Route | Factsheet radius |
| --- | --- |
| `/hd-209458b/` | 1.359 Jupiter radii |
| `/k2-18b/` | 2.610 Earth radii |
| `/kepler-186f/` | 1.17 Earth radii |
| `/kepler-452b/` | 1.63 Earth radii |
| `/wasp-39b/` | 1.279 Jupiter radii |

K2-18 b was also opened at device pixel ratio 2 with the same 1280 × 720 CSS viewport. Its scene and factsheet settled with zero console errors. The inspected captures show a neutral gray sphere and the radius fact at [1×](images/k2-18b-factsheet.png) and [2×](images/k2-18b-factsheet-dpr2.png). They are display checks, not a pixel-matched size oracle; the numerical test checks the prepared scale.

## Limb overlay inventory

Seven of the 17 registered **exoplanet** scenes publish a limb plate: WASP-43 b, HD 189733 b, TRAPPIST-1 b and c, and Beta Pictoris b, c and d. WASP-43 b has one for each of two lenses, for eight plate files total. I fetched all eight from their published content-addressed URLs, matched their SHA-256 values to the inventories and decoded their alpha channels with Sharp. Every alpha maximum was zero, so **none of the 17 planets has a visible limb plate**; the other ten do not declare one. Earth's white limb overlay with Shadows off is a separate presentation feature and is not used by these exoplanets.

The nine **host-star** packages all mount a separate limb layer above their prepared spheres. Their published limb images were fetched and decoded separately. Eight have nonzero alpha: WASP-39, WASP-43, HD 189733, HD 209458, K2-18, Kepler-186, Kepler-452 and Beta Pictoris. Their maximum alpha values are 80, 77, 97, 93, 141, 119, 111 and 91 respectively. TRAPPIST-1's 84-byte plate has zero alpha throughout. These are asset and renderer checks, not a measured visibility threshold. The eight stars' source recipes identify quadratic limb-darkening laws from transit fits or stellar-atmosphere models; TRAPPIST-1's recipe explicitly says no limb darkening is represented. The WASP-39 and WASP-43 recipes still describe their limb *plates* as transparent even though their published pixels are not; that metadata needs a separate correction before it can be used as evidence for the plate's physical meaning.

The radius changes also alter the shared Sun world context. Its full context and summary were regenerated from the updated object frames, repinned in the Sun inventory and published; the orbit bank hash remained unchanged. This closes the renderer CI fixture that compares each context radius with its selectable scene radius.

## Source-backed limb opportunity

The current source recipes support a distinct answer for the two classes. Eight host stars already select a quadratic profile from transit fits or a cited stellar-atmosphere grid; TRAPPIST-1 has a measured colour but no selected limb profile. Four planets (WASP-43 b, HD 189733 b, TRAPPIST-1 b and c) have prepared scientific temperature or emission fields, but none selects a measured or modeled radial limb law. The other 13 planets select neutral shape displays, including the three self-luminous Beta Pictoris planets. No planet has a nontransparent limb plate. These counts describe the checked-in packages, not the limits of future observations.

A source-backed **limb treatment** for all 26 bodies is feasible as a body-by-body source and model project. A nontransparent overlay for all 26 is not supported by the current inputs. Each visible model needs a named observation or physical law, a bandpass, parameters appropriate to that body's selected lens, and a label that distinguishes fitted measurements from modeled assumptions. A sphere's geometric silhouette is already a valid limb for a package without evidence for atmospheric scattering or rim emission. A uniform glow added to every planet would claim a physical effect that these current source records do not support.

I used the repository's bounded `pnpm telescope papers` OpenAlex search with target and topic filters, then inspected the primary texts of the promising leads. The search matches title and abstract, so a result count is not an exhaustive literature count: it missed the two useful papers below whose limb values appear deeper in the text.

| Target and Telescope API topic | Candidates | Paper finding and presentation limit |
| --- | ---: | --- |
| TRAPPIST-1, `limb darkening` | 7 | [Gillon et al. (2016), Extended Data Table 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC5321506/) gives a quadratic I+z profile, `u1 = 0.65 ± 0.10`, `u2 = 0.28 ± 0.12`. The paper says these were inferred from theoretical tables and used as transit priors. This is a concrete **modeled**, red-band stellar plate candidate, not an observed resolved limb. It was found by inspecting the full paper after the API search. |
| WASP-39 b, `limb` | 7 | [Espinoza et al. (2024)](https://www.nature.com/articles/s41586-024-07768-4) reports distinct JWST/NIRSpec morning and evening *transmission* spectra, differing by `405 ± 88 ppm` on average. This can constrain an asymmetric wavelength-dependent occulting limb; it does not measure a glowing white planetary rim. The paper did not appear in the filtered API results. |
| WASP-43 b, `phase curve` | 1 | [Bell et al. (2024)](https://www.nature.com/articles/s41550-024-02230-x) measures a JWST/MIRI 5–12 µm thermal phase curve. It constrains the dayside and nightside emission already modeled in the package, but supplies no separate spatially resolved radial limb profile. The API returned its 2023 first-look preprint. |
| HD 209458 b, `atmosphere` | 36 | [Vidal-Madjar et al. (2011)](https://arxiv.org/abs/1012.5938) locates sodium absorption through more than 6,500 km of upper atmosphere. A source-backed sodium-band transit view is plausible; that altitude cannot be applied as a broadband emission halo. |
| TRAPPIST-1 system, `transmission` | 41 | [de Wit et al. (2016)](https://arxiv.org/abs/1606.01103) rules out cloud-free hydrogen-rich envelopes for b and c. [Piaulet-Ghorayeb et al. (2025)](https://arxiv.org/abs/2508.08416) sets limits for d. These constrain atmospheric models; they do not justify the same nontransparent plate on all seven planets. |
| K2-18 b, `transmission` | 48 | [Schmidt et al. (2025)](https://doi.org/10.3847/1538-3881/ae019a) reanalyses JWST transmission spectra and retrievals. The measurements are wavelength-dependent transit depths, not a resolved radial brightness profile. |
| Kepler-186 f and Kepler-452 b, `atmosphere` | 2 and 4 | The bounded results were habitability or interior models, with no body-specific measured limb profile among the returned works. Keep the neutral geometric silhouette until a selected atmosphere model has parameters and a matching bandpass. |
| Beta Pictoris b, `atmosphere` | 5 | [2026 JWST NIRCam variability work](https://arxiv.org/abs/2607.13133) is a candidate for time-dependent brightness, but does not report a spatially resolved limb profile. |

The full authoring provenance pass could not complete in this selective checkout because the unrelated M31 image-layer bank is absent. The affected bodies' provenance was regenerated directly, and the published-catalogue check above passed. Repository-wide typechecking also needs ignored prepared assets outside these packages and was not used as evidence for this change.
