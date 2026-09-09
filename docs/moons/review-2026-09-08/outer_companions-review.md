# Outer moons and selected companions — source feasibility review

Checked 2026-09-08; reference `7b289887ee03e040b981f6aaff25390d1e17ca9c`. All **72/72** assigned entries reviewed: **28 existing packages and 44 missing packages**. This completes the bounded source survey, not implementation or runtime qualification.

Disposition counts: **22 retain-existing**, **6 improve-existing**, **8 model-candidate**, **14 observation-candidate**, **22 orbit-context-only**.

## Best-supported next investigations

- **Squannit** is the clearest new mesh candidate. The [PDS directory](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.jpl.radar.shape_models_V1_0/data/) actually lists `a66391_1999kw4_secondary.obj` and `a66391_beta_spin_state.csv`. This is 1999 KW4 Beta, the Moshup companion. Pin payloads, units and libration/attitude before preparation; a later scaled Dimorphos proxy is not the original source.
- **Hiʻiaka** has a [2025 occultation model](https://www.nature.com/articles/s41467-025-65749-1) and an actually linked Source Data workbook. Its quoted axes are **semi-axes**, not full dimensions. This supports an inferred triaxial body with uncertainty, not a terrain mesh. The article is CC BY-NC-ND 4.0; inspect selected data terms before reuse.
- **Menoetius and Romulus** have [occultation](https://www2.boulder.swri.edu/~buie/biblio/pub099.html) and [projected-limb](https://www.sciencedirect.com/science/article/abs/pii/S001910351400308X) evidence respectively. Their third dimensions require assumptions or combined photometry. They are model-family candidates, not released observed meshes.
- **Dactyl and Selam** deserve substantial observation work. Dactyl has Galileo imaging; Selam has [Lucy contact-binary observations](https://pmc.ncbi.nlm.nih.gov/articles/PMC11136651/) and an actual linked mission collection. Neither inherits its parent’s detailed shape. Image registration and a released measured companion reconstruction remain unresolved.
- **Charon** has a concrete missed [PDS color/composition map collection](https://pds-smallbodies.astro.umd.edu/holdings/pds4-nh_derived-v4.0/plutosystem_composition/overview.pdf). This is a concrete improvement lead; global map extent does not prove uniform observed coverage. Nix/Hydra have image cubes in the same collection, but those are not already registered global maps for their public meshes.
- **Caliban, Sycorax, Prospero and Setebos** have useful K2 rotation/brightness constraints. Only assumption-dependent ellipsoid families are supported; Prospero/Setebos single- versus double-peaked period choices must stay explicit. Ferdinand’s sparse sampling justifies an observation disposition first.
- **Cupid, Mab, Perdita, Hippocamp and Neso** have real photometric/spectral observations worth exposing. These data support measurement views, not arbitrary cratered spheres. Cupid’s strong hemispheric brightness asymmetry does not uniquely determine elongation.

## Existing-package findings

All 28 SOURCE records, preparation recipes and content records were inspected at the merged reference. Most current representations correctly separate measured imagery, analytic shape and missing coverage. This review retained 22 and identified six improvement tracks: Titania geological registration, Miranda digitized geology access, Proteus source documentation/color registration, Charon global color/composition, and Nix/Hydra image-to-mesh registration. The latter two public meshes omit their fitted camera attitude; 2025 presentations do not resolve that release gap.

Proteus SOURCE contains a physical-placement paragraph naming Larissa. That is a concrete documentation correction candidate; no application/source file was edited here. Stooke radial grids for Larissa/Proteus remain broad shape models, not fine local altimetry. Uranian prolate fits do not independently measure their repeated third axes.

## All assigned rows

| Parent | Body | Disposition | Next action |
|---|---|---|---|
| Uranus | Ariel | retain-existing | Retain the current lenses and their separate coverage masks. |
| Uranus | Umbriel | retain-existing | Retain monochrome; require an actual gridded terrain product before elevation. |
| Uranus | Titania | improve-existing | Qualify the geologic/deblurred product and its registration before adding a lens. |
| Uranus | Oberon | retain-existing | Retain monochrome; keep geological registration as a research lead. |
| Uranus | Miranda | improve-existing | Inspect the linked geology files, projection and usage terms. |
| Uranus | Cordelia | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Ophelia | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Bianca | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Cressida | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Desdemona | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Juliet | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Portia | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Rosalind | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Belinda | retain-existing | Retain measured/prolate model; preserve unobserved-surface treatment. |
| Uranus | Puck | retain-existing | Retain partial imagery; optional source-backed light-curve explanation needs follow-up data selection. |
| Uranus | Caliban | model-candidate | Select a justified model family and scale; keep unknown pole/third axis visible. |
| Uranus | Sycorax | model-candidate | Select a justified model family and scale; keep unknown pole/third axis visible. |
| Uranus | Prospero | model-candidate | Select a justified model family and scale; keep unknown pole/third axis visible. |
| Uranus | Setebos | model-candidate | Select a justified model family and scale; keep unknown pole/third axis visible. |
| Uranus | Stephano | observation-candidate | Inspect original VLT measurements before adopting a rotation model. |
| Uranus | Trinculo | observation-candidate | Inspect original VLT measurements before adopting a rotation model. |
| Uranus | Francisco | orbit-context-only | Qualify an ephemeris interval if selected for system context. |
| Uranus | Margaret | orbit-context-only | Qualify an ephemeris interval if selected for system context. |
| Uranus | Ferdinand | observation-candidate | Inspect time-series sampling and alternative periods before any model. |
| Uranus | Perdita | observation-candidate | Select original photometry and improve size/shape constraints before scene modeling. |
| Uranus | Mab | observation-candidate | Select original photometry and improve size/shape constraints before scene modeling. |
| Uranus | Cupid | observation-candidate | Select original photometry and improve size/shape constraints before scene modeling. |
| Uranus | S/2025 U1 | orbit-context-only | Pin discovery astrometry and future validated ephemeris if selected. |
| Uranus | S/2023 U1 | orbit-context-only | Use named discovery astrometry to choose a supported ephemeris interval. |
| Neptune | Triton | retain-existing | Retain both maps with measured coverage and enhanced-color wording. |
| Neptune | Nereid | retain-existing | Retain model with its explicit inference and pose caveats. |
| Neptune | Naiad | retain-existing | Retain analytic shape and coverage wording. |
| Neptune | Thalassa | retain-existing | Retain analytic shape and coverage wording. |
| Neptune | Despina | retain-existing | Retain analytic shape and coverage wording. |
| Neptune | Galatea | retain-existing | Retain analytic shape and coverage wording. |
| Neptune | Larissa | retain-existing | Retain observation and broad radial-shape lenses. |
| Neptune | Proteus | improve-existing | Correct SOURCE physical-placement paragraph naming Larissa; separately qualify color-frame registration. |
| Neptune | Halimede | orbit-context-only | Select current ephemeris solution and original component photometry if a context entry is desired. |
| Neptune | Psamathe | orbit-context-only | Select current ephemeris solution and original component photometry if a context entry is desired. |
| Neptune | Sao | orbit-context-only | Select current ephemeris solution and original component photometry if a context entry is desired. |
| Neptune | Laomedeia | orbit-context-only | Select current ephemeris solution and original component photometry if a context entry is desired. |
| Neptune | Neso | observation-candidate | Preserve original errors and acquire tabular observations before chart preparation. |
| Neptune | Hippocamp | observation-candidate | Inspect linked intermediate images and JWST tables for a source-backed observation view. |
| Neptune | S/2002 N5 | orbit-context-only | Use named discovery astrometry to choose a supported ephemeris interval. |
| Neptune | S/2021 N1 | orbit-context-only | Use named discovery astrometry to choose a supported ephemeris interval. |
| Pluto | Charon | improve-existing | Select actual Charon global color/absorption files, verify projection, units, coverage and calibration. |
| Pluto | Nix | improve-existing | Recover or fit camera-to-mesh transforms and validate selected LORRI/MVIC observations. |
| Pluto | Hydra | improve-existing | Qualify camera-to-mesh orientation and the observed-hemisphere coverage mask. |
| Pluto | Kerberos | retain-existing | Retain approximate model; revisit only with fitted attitude or improved released shape. |
| Pluto | Styx | retain-existing | Retain current model and uncertain-pole wording. |
| Haumea | Hiʻiaka | model-candidate | Inspect linked workbook and its reuse terms, pin axis/spin conventions, then qualify an analytic model. |
| Haumea | Namaka | orbit-context-only | Select the full interacting orbital solution; keep assumed radius separate. |
| Eris | Dysnomia | observation-candidate | Read selected ALMA products and model assumptions before adopting a size representation. |
| Makemake | S/2015 (136472) 1 (MK2) | orbit-context-only | Pin the fitted orbital table/uncertainties and require validation before playback. |
| Gonggong | Xiangliu | orbit-context-only | Reconcile published ephemeris branches and size assumptions. |
| Quaoar | Weywot | orbit-context-only | Use the revised solution and verify uncertainties rather than copying an older eccentric orbit. |
| Orcus | Vanth | observation-candidate | Reconcile occultation and thermal size models; inspect original chords before geometry choice. |
| Salacia | Actaea | orbit-context-only | Select component-specific photometry; do not convert parent variability into moon shape. |
| Varda | Ilmarë | orbit-context-only | Pin component orbital/photometric tables and preserve thermal partition assumptions. |
| Ida | Dactyl | observation-candidate | Pin actual SSI products, calibrate image/shape pose and investigate published shape reconstruction. |
| Dinkinesh | Selam | observation-candidate | Inspect released Lucy files and supplementary geometry; determine whether a measured Selam mesh is released. |
| Moshup | Squannit | model-candidate | Pin OBJ/XML and spin CSV bytes, units, frame, usage terms and libration convention; prepare reproducibly. |
| Kalliope | Linus | observation-candidate | Inspect original occultation chords and fit assumptions before approving a model. |
| Daphne | Peneius | orbit-context-only | Pin satellite-specific orbit tables and uncertainty; defer scene shape. |
| Eugenia | Petit-Prince | orbit-context-only | Pin correct outer-moon identity and full dynamical solution. |
| Sylvia | Romulus | model-candidate | Reconstruct published projected limb with errors; constrain or visibly bracket the unmeasured third axis. |
| Sylvia | Remus | observation-candidate | Inspect Remus-specific 2019 chords before assigning size/shape confidence. |
| Kleopatra | Alexhelios | orbit-context-only | Pin the named moon state and full primary-gravity solution. |
| Kleopatra | Cleoselene | orbit-context-only | Pin the named moon state and full primary-gravity solution. |
| Eurybates | Queta | orbit-context-only | Pin HST orbit solution and uncertainty; await actual resolved observations for a surface scene. |
| Hektor | Skamandrios | orbit-context-only | Pin companion orbital solution and distinguish parent rotation/model. |
| Patroclus | Menoetius | model-candidate | Inspect full chord solution, derive consistent physical axes and pin mutual spin/orbit convention. |

## Rejected or unresolved shortcuts

- A parent mesh is not a companion mesh: checked examples include Ida/Dactyl, Dinkinesh/Selam, Kalliope/Linus, Daphne/Peneius, Sylvia/Romulus/Remus, Kleopatra and Hektor.
- A thermal diameter or photometric size is not measured 3D shape. This is the main limit for most trans-Neptunian companions and newly discovered irregulars.
- A predicted occultation is not a measured limb. No 2024–2035 prediction was counted as new physical data.
- A press rendering, hobbyist Celestia model or formation-simulation mesh does not establish observed surface geometry.
- Source Data XLSX links, OBJ directory entries and paper metadata prove that a release is identified; they do not prove byte integrity, license suitability or frame conventions.

## Limits and handoff

- Bounded source-feasibility review only. No source acquisition/preparation, implementation, PR, build, render, browser test or package qualification gates were run.
- All 28 existing SOURCE records, recipes and object content were read at merged reference 7b289887ee03e040b981f6aaff25390d1e17ca9c; working checkout is older and dirty and was preserved.
- Linked release metadata or directory inventory is not equivalent to decoding/validating payloads. Individual inaccessible URLs are marked metadata-only or unresolved.
- Negative findings mean not identified in the stated checked source scope, never proof that data do not exist.
- Period, radius, projected limb, inferred ellipsoid, parent shape and measured companion mesh are intentionally separate. Model-candidate does not mean uniquely known 3D shape or implementation-ready.
- Exact 72-row input scope is preserved. Additional companions/new discoveries outside it were not added. Native aliases remain in row search evidence.
- Orbit-only context does not authorize fabricated body scenes or co-rendering multiple objects; any later product must follow the generic one-scene contract.
- Article/source-data reuse terms, units, frames, orientation epochs and reproducible byte closure require selection-specific qualification. No blanket redistribution clearance is asserted.

The JSON companion contains per-body geometry, imagery, orbit, searches, blockers, confidence and linked source records. No PR should be selected from a candidate label alone; finish the specific source/registration action first.
