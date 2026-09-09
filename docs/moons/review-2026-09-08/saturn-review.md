# Saturn moon source-feasibility review — 2026-09-08

All **293 Saturn entries** received a bounded evidence-backed review. **28 packages exist and 265 remain unimplemented**. All 35 missing named moons were individually investigated. Source implementation was inspected at `7b289887ee03e040b981f6aaff25390d1e17ca9c`; the working checkout was not treated as the merged source. This review does not qualify new scenes or authorize a PR.

## Decisions

| Disposition | Rows | Meaning |
|---|---:|---|
| retain-existing | 12 | Current source choices remain appropriate within their stated limits. |
| improve-existing | 16 | A concrete source opportunity or registration/release problem merits work. |
| model-candidate | 18 | Quantitative inferred elongation exists; physical axes/mesh are not fully measured. |
| observation-candidate | 4 | Photometry or Cassini ring observations can support an observation presentation. |
| orbit-context-only | 243 | Identity/orbital evidence exists; no physical scene source was established in the bounded survey. |

**Best next choices after the complete document review**

1. **Tethys, Dione and Rhea measured geometry.** Their current recipes render spheres despite released 2025 SPC topography. Rhea actually lists Q128/Q512 OBJ files. Tethys/Dione landing pages and release directories are confirmed, but the global subdirectories returned HTTP 403, so their individual mesh labels/bytes remain a preflight item. Preserve each image projection and terrain datum; the current rendered radii are not interchangeable with DEM reference radii. [Tethys](https://sbn.psi.edu/pds/resource/weirichtethysshape.html), [Dione](https://sbn.psi.edu/pds/resource/weirichdioneshape.html), [Rhea data](https://sbnarchive.psi.edu/pds4/cassini/satellite-rhea.cassini.shape-models-maps/data/).
2. **Enceladus measured ellipsoid and relief.** The current scene has a sphere although its 200 m DEM uses a reference ellipsoid with semi-axes 256.2 × 251.4 × 248.6 km. This gives a concrete geometry improvement; terrain holes and reference conventions must survive preparation. [2024 controlled map](https://astrogeology.usgs.gov/search/map/enceladus-cassini-global-mosaic-100m-schenk).
3. **Scientific observations beyond globes.** The authors released actual wavelength/flux/error CSVs for Epimetheus, Pandora, Telesto and Pallene. This review read 730, 700, 860 and 860 dither1 samples respectively. Their available ranges differ: roughly 1.35–5.00, 1.50–5.00, 0.70–5.00 and 0.70–5.00 μm. Ymir has released numeric Cassini lightcurves; Methone has a Cassini VIMS comparison spectrum, not a JWST observation. These could become uncertainty-aware charts, not invented surface lenses. [Pinned spectrum repository](https://github.com/JWSTGiantPlanets/SaturnRingsMoons/tree/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab), [Ymir data](https://tilmanndenk.de/wp-content/uploads/619_Ymi_4_LC_Paper1.txt).
4. **Selective new irregular models.** Bebhionn (minimum a/b 1.41), Erriapus (1.51), Bestla (1.47), Hati (1.42) and Mundilfari (1.43) offer useful elongation constraints. Tarqeq adds a distinct 76.13-hour period. These are source-informed approximations with unknown polar dimensions and albedo-dependent scale. Ranking them above nearly spherical or tentative targets is an editorial judgment, not greater measurement precision. [Denk et al. Table 3](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf).
5. **Titan topographic coverage.** Cornell separately releases altimetry/stereo data, a sparse grid and an interpolated grid. The paper describes only about 9% directly measured surface coverage. A measured-coverage elevation view is a useful ambition; a fully measured global terrain claim would be false. [Paper](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2017GL075518), [actual file inventory](https://data.astro.cornell.edu/titan_topo_corlies/full_dataset/).

## Cassini irregular-body evidence

Table 3 has **25 individually reconciled targets and 23 numerical minimum equatorial ratios**. Narvi and Kari are the two exceptions: observed three-maxima lightcurves do not supply numeric axes. Phoebe also has resolved spacecraft data; the other 24 are unresolved Cassini photometry in this table. A minimum-ratio ellipsoid is not a measured triaxial body or downloaded convex mesh. The 2026 review mentions 13 calculated convex models but cites papers in preparation; this is not a release. [2018 paper](https://tilmanndenk.de/wp-content/uploads/DenkEtAl2018_IrregularMoons.pdf), [2026 review](https://tilmanndenk.de/wp-content/uploads/2026_SSR_DenkEtAl_IoMinorMoons.pdf).

| Body | Period (hours) | Minimum a/b | Decision | Specific limit |
|---|---:|---:|---|---|
| Phoebe | 9.2735 ± 0.0006 | 1.01 | improve-existing | Existing package retains its body-specific shape and orientation assumptions. |
| Kiviuq | 21.97 ± 0.16 | 2.32 | retain-existing | Existing package retains its body-specific shape and orientation assumptions. |
| Ijiraq | 13.03 ± 0.14 | 1.08 | model-candidate | Shallow lightcurve supports a modest equatorial constraint; polar dimension remains unknown. |
| Paaliaq | 18.79 ± 0.09 | 1.05 | model-candidate | Four maxima/minima make a simple ellipsoid a poor explanation of the measured lightcurve; contact-binary interpretation is unestablished. |
| Tarqeq | 76.13 ± 0.04 | 1.32 | model-candidate | Long 76.13-hour period and q=1.32 give a distinct bounded model opportunity. |
| Siarnaq | 10.18785 ± 5e-05 | 1.17 | improve-existing | Existing package retains its body-specific shape and orientation assumptions. |
| Albiorix | 13.33 ± 0.03 | 1.34 | improve-existing | Existing package retains its body-specific shape and orientation assumptions. |
| Bebhionn | 16.33 ± 0.03 | 1.41 | model-candidate | Useful minimum elongation from the lightcurve; absolute scale remains albedo-dependent. |
| Erriapus | 28.15 ± 0.25 | 1.51 | model-candidate | Strong useful elongation floor; a contact neck or binary would be speculative. |
| Tarvos | 10.691 ± 0.001 | 1.08 | model-candidate | Low elongation floor; multiple extrema mean it is not an actual recovered surface. |
| Narvi | 10.21 ± 0.02 | not supplied | observation-candidate | Three maxima are observed, but Table 3 leaves minimum axis ratio blank; no numeric axes or native shape release qualified. |
| Bestla | 14.6238 ± 0.0001 | 1.47 | model-candidate | Published south-ecliptic pole latitude approximately -85 ± 15 degrees and sidereal period are useful; do not invent a pole longitude or native convex mesh. |
| Skathi | 11.1 ± 0.02 | 1.27 | model-candidate | Use exact Skathi = legacy JPL Skadi identity, code 627; no body-fixed pole follows from this ratio. |
| Skoll | 7.26 ± 0.09 ? | 1.14 | model-candidate | 7.26-hour solution is tentative and some data do not fit; no established wobble or binary interpretation. |
| Hyrrokkin | 12.76 ± 0.03 | 1.27 | model-candidate | Three maxima prevent treating an ellipsoid as a recovered physical outline. |
| Greip | 12.75 ± 0.35 ? | 1.18 | model-candidate | Period tentative; an approximately 19-hour alternative remains possible. |
| Suttungr | 7.67 ± 0.02 | 1.18 | model-candidate | Two/three extrema; ellipsoid demonstrates only the minimum elongation. |
| Thrymr | 38.79 ± 0.25 ? | 1.21 | model-candidate | Published period is tentative; do not show it as a secure current rotation prediction. |
| Mundilfari | 6.74 ± 0.08 | 1.43 | model-candidate | Single roughly nine-hour Cassini sequence at 36-degree phase; model confidence must remain bounded. |
| Hati | 5.45 ± 0.04 | 1.42 | model-candidate | 5.45 ± 0.04 hours used from Table 3 and body page; overview wording 5.42 is inconsistent. Useful elongation floor. |
| Bergelmir | 8.13 ± 0.09 | 1.13 | model-candidate | Modest elongation floor; lightcurve does not establish a polar axis. |
| Kari | 7.7 ± 0.14 | not supplied | observation-candidate | Three maxima are observed, but Table 3 gives no minimum axis ratio; numeric shape not qualified. |
| Loge | 6.9 ± 0.1 ? | 1.04 | model-candidate | Shallow low-SNR photometry and tentative period; low visual return from q=1.04. |
| Ymir | 11.9222 ± 2e-05 | 1.37 | improve-existing | Existing package retains its body-specific shape and orientation assumptions. |
| Fornjot | 9.5 ? | 1.11 | model-candidate | Very weak period determination; author table allows 7 or 9.5 hours. Do not animate a unique measured period. |

## Catalog and ephemeris reconciliation

All **96 distinct MPEC notices were fetched and read**, and **231 of 231 referenced rows matched their exact designation in the actual notice text**. Each row retains its notice URL through the source ledger. This is direct astrometric identity evidence, not merely a link to a discovery homepage. The remaining catalog rows use IAU/IAUC references and target-specific mission/physical evidence.

The JPL mean-elements inventory matches **291** of the 293 rows; the grouped ephemerides page matches **284**. The differences were followed into released kernel comments:

- **SAT459** explicitly supplies the 18 new irregulars S/2020 S45–S49 and S/2023 S51–S63, codes 65286–65303. Seven are missing from the grouped page, and eleven still have its older SAT458 label. Each row uses the actual SAT459 membership. [Actual comments](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/satellites/sat459.cmt).
- **S/2009 S2** is absent from both summary tables but has the July 2026 **SAT480 / NAIF 65304** release, fitted to Cassini images, nominally spanning 1950–2050. The axis fields are unmodeled zeros. MPEC 2026-M19 reports four 2009 images without their calibrated image IDs or body dimensions. A real orbit source does not establish a renderable body shape. [Notice](https://www.minorplanetcenter.net/mpec/K26/K26M19.html), [actual comments](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/satellites/sat480.cmt).
- **S/2009 S1** remains a historical compact B-ring shadow/detection opportunity with no qualified current ephemeris found in the checked inventories. Its approximate 0.3 km inferred size is not measured axes. Resolve original image identity and physical interpretation before a scene. [Primary paper](https://arxiv.org/abs/0912.3489).
- **Skathi** is reconciled with JPL legacy **Skadi**, code 627. **SAT415** metadata ends in 2018; source file dates cannot qualify a contemporary runtime preview.

The older author physical table has exactly **122 matched irregulars**. The other **146 irregulars** are newer discoveries outside its scope. Every row was checked individually against the actual table, discovery identity and applicable Cassini/shape product membership. The resulting 243 orbit-context decisions mean that this bounded review established context but no source-backed physical scene; they do not claim these objects have never been physically observed. [Physical table](https://tilmanndenk.de/wp-content/uploads/OSM_7_Table.txt).

## Existing packages and unresolved leads

All 28 existing SOURCE.md files, manifests, content and terrestrial recipes were read. The eleven-target Thomas shape release was reconciled target by target: Pan, Daphnis, Atlas, Prometheus, Pandora, Epimetheus, Janus, Telesto, Calypso, Helene and Hyperion. Methone, Pallene, Polydeuces, Anthe and Aegaeon are individually outside that mesh release, with their own measured-axis or estimated-size evidence. No such body inherited a mesh claim from its family. [PDS inventory](https://sbn.psi.edu/pds/resource/saturnsatshapes.html).

| Existing body | Decision | Concrete next action |
|---|---|---|
| Mimas | retain-existing | Keep current measured mesh/maps; consider the body-specific JWST CO2 chart after shared chart capability exists. |
| Enceladus | improve-existing | Prepare ellipsoid-plus-valid-DEM geometry and test registration; optionally add hemisphere spectral measurements. |
| Tethys | improve-existing | Inspect individual 2025 mesh/assessment labels, then prepare measured shape against current maps. |
| Dione | improve-existing | Identify and pin native global mesh and assessment products; prepare body-specific relief geometry. |
| Rhea | improve-existing | Read mesh labels and uncertainty grids, choose a measured geometry approximation, and preserve projection/datum distinctions. |
| Titan | improve-existing | Prototype a coverage-aware measured elevation lens; audit units, projection and measured support before using interpolation. |
| Hyperion | improve-existing | Resolve actual 2025 numeric mesh/DEM/map deposit and compare frame before deciding to replace current products; JWST spectrum is a separate chart opportunity. |
| Iapetus | retain-existing | Keep current imagery; reopen geometry when a released Iapetus topography product can be pinned. |
| Phoebe | improve-existing | Qualify regional color camera/map registration against the existing mesh, or extract released JWST spectrum as a chart. |
| Janus | retain-existing | Retain current measured-shape/observation package; require multiband registration and native-pixel evidence for any added color lens. |
| Epimetheus | improve-existing | Prepare a disk-integrated spectrum chart with retained uncertainties and validated wavelength units. |
| Helene | retain-existing | Retain current measured-shape/observation package; require multiband registration and native-pixel evidence for any added color lens. |
| Telesto | improve-existing | Prepare a disk-integrated spectrum chart with retained uncertainties and validated wavelength units. |
| Calypso | retain-existing | Retain current measured-shape/observation package; require multiband registration and native-pixel evidence for any added color lens. |
| Atlas | retain-existing | Retain current measured-shape/observation package; require multiband registration and native-pixel evidence for any added color lens. |
| Prometheus | retain-existing | Retain current measured-shape/observation package; require multiband registration and native-pixel evidence for any added color lens. |
| Pandora | improve-existing | Prepare a disk-integrated spectrum chart with retained uncertainties and validated wavelength units. |
| Pan | retain-existing | Retain current measured-shape/observation package; require multiband registration and native-pixel evidence for any added color lens. |
| Ymir | improve-existing | Prepare a measured lightcurve chart with phase/sequence labels; preserve source model assumptions. |
| Kiviuq | retain-existing | Keep explicit model assumptions; revisit when target-specific convex mesh or numeric observation product adds useful evidence. |
| Albiorix | improve-existing | Resolve MAST program 3716 data and publish an uncertainty-aware spectrum chart after numeric closure. |
| Siarnaq | improve-existing | Obtain program 3716 spectrum and prepare a measured chart; replace authored model only if a native release becomes accessible. |
| Methone | improve-existing | Review the spectrum text columns and normalization in the author notebook, then prepare a Cassini spectrum chart. |
| Pallene | improve-existing | Prepare a measured spectrum chart retaining error/noisy samples and exact dataset provenance. |
| Polydeuces | retain-existing | Retain measured-axis and sparse-imagery presentation; recheck only if a materially better registered source appears. |
| Daphnis | retain-existing | Retain current measured-shape/observation package; require multiband registration and native-pixel evidence for any added color lens. |
| Anthe | retain-existing | Keep estimated-size labeling and full missing-data grid; do not promote it to measured-shape coverage. |
| Aegaeon | improve-existing | Resolve published versus OPUS longitude conventions and native camera/disc registration for the best existing candidates. |

Ymir’s exact native OBJ link still returns 404, while its numerical lightcurve release is readable. Hyperion’s 2025 50 m mapping paper is promising but no actual downloadable numeric map/DEM identity was established. Aegaeon already has resolved candidate images; the blocker is longitude/camera registration, not absence of imagery. Enceladus/Iapetus forthcoming SPC statements remain future leads. Albiorix/Siarnaq/Phoebe and eight larger moon JWST papers supply exact target/MAST archive identities, but their processed-data closure was not established. Titan’s color composite with undocumented observed-versus-filled support stays withheld.

## Complete row ledger

The JSON companion is the canonical detailed record: all 293 exact input keys, geometry/imagery/orbit evidence, source IDs, individual searches, next action, blocker, effort and confidence. This compact table provides complete human-readable coverage.

| Key | Body | Scene | Decision | JPL/NAIF source |
|---|---|---|---|
| `Saturn / I` | Mimas | present | retain-existing | SAT441 / 601 |
| `Saturn / II` | Enceladus | present | improve-existing | SAT441 / 602 |
| `Saturn / III` | Tethys | present | improve-existing | SAT441 / 603 |
| `Saturn / IV` | Dione | present | improve-existing | SAT441 / 604 |
| `Saturn / V` | Rhea | present | improve-existing | SAT441 / 605 |
| `Saturn / VI` | Titan | present | improve-existing | SAT441 / 606 |
| `Saturn / VII` | Hyperion | present | improve-existing | SAT441 / 607 |
| `Saturn / VIII` | Iapetus | present | retain-existing | SAT441 / 608 |
| `Saturn / IX` | Phoebe | present | improve-existing | SAT441 / 609 |
| `Saturn / X` | Janus | present | retain-existing | SAT415 / 610 |
| `Saturn / XI` | Epimetheus | present | improve-existing | SAT415 / 611 |
| `Saturn / XII` | Helene | present | retain-existing | SAT441 / 612 |
| `Saturn / XIII` | Telesto | present | improve-existing | SAT441 / 613 |
| `Saturn / XIV` | Calypso | present | retain-existing | SAT441 / 614 |
| `Saturn / XV` | Atlas | present | retain-existing | SAT415 / 615 |
| `Saturn / XVI` | Prometheus | present | retain-existing | SAT415 / 616 |
| `Saturn / XVII` | Pandora | present | improve-existing | SAT415 / 617 |
| `Saturn / XVIII` | Pan | present | retain-existing | SAT415 / 618 |
| `Saturn / XIX` | Ymir | present | improve-existing | SAT456 / 619 |
| `Saturn / XX` | Paaliaq | not-started | model-candidate | SAT456 / 620 |
| `Saturn / XXI` | Tarvos | not-started | model-candidate | SAT456 / 621 |
| `Saturn / XXII` | Ijiraq | not-started | model-candidate | SAT456 / 622 |
| `Saturn / XXIII` | Suttungr | not-started | model-candidate | SAT456 / 623 |
| `Saturn / XXIV` | Kiviuq | present | retain-existing | SAT456 / 624 |
| `Saturn / XXV` | Mundilfari | not-started | model-candidate | SAT456 / 625 |
| `Saturn / XXVI` | Albiorix | present | improve-existing | SAT456 / 626 |
| `Saturn / XXVII` | Skathi | not-started | model-candidate | SAT456 / 627 |
| `Saturn / XXVIII` | Erriapus | not-started | model-candidate | SAT456 / 628 |
| `Saturn / XXIX` | Siarnaq | present | improve-existing | SAT456 / 629 |
| `Saturn / XXX` | Thrymr | not-started | model-candidate | SAT456 / 630 |
| `Saturn / XXXI` | Narvi | not-started | observation-candidate | SAT456 / 631 |
| `Saturn / XXXII` | Methone | present | improve-existing | SAT441 / 632 |
| `Saturn / XXXIII` | Pallene | present | improve-existing | SAT415 / 633 |
| `Saturn / XXXIV` | Polydeuces | present | retain-existing | SAT441 / 634 |
| `Saturn / XXXV` | Daphnis | present | retain-existing | SAT415 / 635 |
| `Saturn / XXXVI` | Aegir | not-started | orbit-context-only | SAT456 / 636 |
| `Saturn / XXXVII` | Bebhionn | not-started | model-candidate | SAT456 / 637 |
| `Saturn / XXXVIII` | Bergelmir | not-started | model-candidate | SAT456 / 638 |
| `Saturn / XXXIX` | Bestla | not-started | model-candidate | SAT456 / 639 |
| `Saturn / XL` | Farbauti | not-started | orbit-context-only | SAT456 / 640 |
| `Saturn / XLI` | Fenrir | not-started | orbit-context-only | SAT456 / 641 |
| `Saturn / XLII` | Fornjot | not-started | model-candidate | SAT456 / 642 |
| `Saturn / XLIII` | Hati | not-started | model-candidate | SAT456 / 643 |
| `Saturn / XLIV` | Hyrrokkin | not-started | model-candidate | SAT456 / 644 |
| `Saturn / XLV` | Kari | not-started | observation-candidate | SAT456 / 645 |
| `Saturn / XLVI` | Loge | not-started | model-candidate | SAT456 / 646 |
| `Saturn / XLVII` | Skoll | not-started | model-candidate | SAT456 / 647 |
| `Saturn / XLVIII` | Surtur | not-started | orbit-context-only | SAT456 / 648 |
| `Saturn / XLIX` | Anthe | present | retain-existing | SAT415 / 649 |
| `Saturn / L` | Jarnsaxa | not-started | orbit-context-only | SAT456 / 650 |
| `Saturn / LI` | Greip | not-started | model-candidate | SAT456 / 651 |
| `Saturn / LII` | Tarqeq | not-started | model-candidate | SAT456 / 652 |
| `Saturn / LIII` | Aegaeon | present | improve-existing | SAT415 / 653 |
| `Saturn / LIV` | Gridr | not-started | orbit-context-only | SAT456 / 654 |
| `Saturn / LV` | Angrboda | not-started | orbit-context-only | SAT456 / 655 |
| `Saturn / LVI` | Skrymir | not-started | orbit-context-only | SAT456 / 656 |
| `Saturn / LVII` | Gerd | not-started | orbit-context-only | SAT456 / 657 |
| `Saturn / LVIII` | S/2004 S26 | not-started | orbit-context-only | SAT456 / 658 |
| `Saturn / LIX` | Eggther | not-started | orbit-context-only | SAT456 / 659 |
| `Saturn / LX` | S/2004 S29 | not-started | orbit-context-only | SAT456 / 660 |
| `Saturn / LXI` | Beli | not-started | orbit-context-only | SAT456 / 661 |
| `Saturn / LXII` | Gunnlod | not-started | orbit-context-only | SAT456 / 662 |
| `Saturn / LXIII` | Thiazzi | not-started | orbit-context-only | SAT456 / 663 |
| `Saturn / LXIV` | S/2004 S34 | not-started | orbit-context-only | SAT456 / 664 |
| `Saturn / LXV` | Alvaldi | not-started | orbit-context-only | SAT456 / 665 |
| `Saturn / LXVI` | Geirrod | not-started | orbit-context-only | SAT456 / 666 |
| `Saturn / LXVII` | S/2004 S7 | not-started | orbit-context-only | SAT457 / 65085 |
| `Saturn / S/2004 S12` | S/2004 S12 | not-started | orbit-context-only | SAT457 / 65086 |
| `Saturn / S/2004 S13` | S/2004 S13 | not-started | orbit-context-only | SAT457 / 65087 |
| `Saturn / S/2004 S17` | S/2004 S17 | not-started | orbit-context-only | SAT457 / 65088 |
| `Saturn / S/2004 S21` | S/2004 S21 | not-started | orbit-context-only | SAT457 / 65079 |
| `Saturn / S/2004 S24` | S/2004 S24 | not-started | orbit-context-only | SAT457 / 65070 |
| `Saturn / S/2004 S28` | S/2004 S28 | not-started | orbit-context-only | SAT457 / 65077 |
| `Saturn / S/2004 S31` | S/2004 S31 | not-started | orbit-context-only | SAT457 / 65067 |
| `Saturn / S/2004 S36` | S/2004 S36 | not-started | orbit-context-only | SAT457 / 65081 |
| `Saturn / S/2004 S37` | S/2004 S37 | not-started | orbit-context-only | SAT457 / 65082 |
| `Saturn / S/2004 S39` | S/2004 S39 | not-started | orbit-context-only | SAT457 / 65084 |
| `Saturn / S/2004 S40` | S/2004 S40 | not-started | orbit-context-only | SAT457 / 65098 |
| `Saturn / S/2004 S41` | S/2004 S41 | not-started | orbit-context-only | SAT457 / 65104 |
| `Saturn / S/2004 S42` | S/2004 S42 | not-started | orbit-context-only | SAT457 / 65108 |
| `Saturn / S/2004 S43` | S/2004 S43 | not-started | orbit-context-only | SAT457 / 65111 |
| `Saturn / S/2004 S44` | S/2004 S44 | not-started | orbit-context-only | SAT457 / 65112 |
| `Saturn / S/2004 S45` | S/2004 S45 | not-started | orbit-context-only | SAT457 / 65113 |
| `Saturn / S/2004 S46` | S/2004 S46 | not-started | orbit-context-only | SAT457 / 65121 |
| `Saturn / S/2004 S47` | S/2004 S47 | not-started | orbit-context-only | SAT457 / 65123 |
| `Saturn / S/2004 S48` | S/2004 S48 | not-started | orbit-context-only | SAT457 / 65139 |
| `Saturn / S/2004 S49` | S/2004 S49 | not-started | orbit-context-only | SAT457 / 65141 |
| `Saturn / S/2004 S50` | S/2004 S50 | not-started | orbit-context-only | SAT457 / 65142 |
| `Saturn / S/2004 S51` | S/2004 S51 | not-started | orbit-context-only | SAT457 / 65150 |
| `Saturn / S/2004 S52` | S/2004 S52 | not-started | orbit-context-only | SAT457 / 65152 |
| `Saturn / S/2004 S53` | S/2004 S53 | not-started | orbit-context-only | SAT457 / 65154 |
| `Saturn / S/2004 S54` | S/2004 S54 | not-started | orbit-context-only | SAT455 / 65158 |
| `Saturn / S/2004 S55` | S/2004 S55 | not-started | orbit-context-only | SAT455 / 65159 |
| `Saturn / S/2004 S56` | S/2004 S56 | not-started | orbit-context-only | SAT455 / 65160 |
| `Saturn / S/2004 S57` | S/2004 S57 | not-started | orbit-context-only | SAT455 / 65161 |
| `Saturn / S/2004 S58` | S/2004 S58 | not-started | orbit-context-only | SAT455 / 65162 |
| `Saturn / S/2004 S59` | S/2004 S59 | not-started | orbit-context-only | SAT455 / 65163 |
| `Saturn / S/2004 S60` | S/2004 S60 | not-started | orbit-context-only | SAT455 / 65164 |
| `Saturn / S/2004 S61` | S/2004 S61 | not-started | orbit-context-only | SAT455 / 65165 |
| `Saturn / S/2005 S4` | S/2005 S4 | not-started | orbit-context-only | SAT457 / 65129 |
| `Saturn / S/2005 S5` | S/2005 S5 | not-started | orbit-context-only | SAT457 / 65135 |
| `Saturn / S/2005 S6` | S/2005 S6 | not-started | orbit-context-only | SAT455 / 65166 |
| `Saturn / S/2005 S7` | S/2005 S7 | not-started | orbit-context-only | SAT455 / 65167 |
| `Saturn / S/2006 S1` | S/2006 S1 | not-started | orbit-context-only | SAT457 / 65089 |
| `Saturn / S/2006 S3` | S/2006 S3 | not-started | orbit-context-only | SAT457 / 65090 |
| `Saturn / S/2006 S9` | S/2006 S9 | not-started | orbit-context-only | SAT457 / 65100 |
| `Saturn / S/2006 S10` | S/2006 S10 | not-started | orbit-context-only | SAT457 / 65109 |
| `Saturn / S/2006 S11` | S/2006 S11 | not-started | orbit-context-only | SAT457 / 65114 |
| `Saturn / S/2006 S12` | S/2006 S12 | not-started | orbit-context-only | SAT457 / 65115 |
| `Saturn / S/2006 S13` | S/2006 S13 | not-started | orbit-context-only | SAT457 / 65117 |
| `Saturn / S/2006 S14` | S/2006 S14 | not-started | orbit-context-only | SAT457 / 65125 |
| `Saturn / S/2006 S15` | S/2006 S15 | not-started | orbit-context-only | SAT457 / 65136 |
| `Saturn / S/2006 S16` | S/2006 S16 | not-started | orbit-context-only | SAT457 / 65137 |
| `Saturn / S/2006 S17` | S/2006 S17 | not-started | orbit-context-only | SAT457 / 65138 |
| `Saturn / S/2006 S18` | S/2006 S18 | not-started | orbit-context-only | SAT457 / 65143 |
| `Saturn / S/2006 S19` | S/2006 S19 | not-started | orbit-context-only | SAT457 / 65149 |
| `Saturn / S/2006 S20` | S/2006 S20 | not-started | orbit-context-only | SAT457 / 65157 |
| `Saturn / S/2006 S21` | S/2006 S21 | not-started | orbit-context-only | SAT455 / 65168 |
| `Saturn / S/2006 S22` | S/2006 S22 | not-started | orbit-context-only | SAT455 / 65169 |
| `Saturn / S/2006 S23` | S/2006 S23 | not-started | orbit-context-only | SAT455 / 65170 |
| `Saturn / S/2006 S24` | S/2006 S24 | not-started | orbit-context-only | SAT455 / 65171 |
| `Saturn / S/2006 S25` | S/2006 S25 | not-started | orbit-context-only | SAT455 / 65172 |
| `Saturn / S/2006 S26` | S/2006 S26 | not-started | orbit-context-only | SAT455 / 65173 |
| `Saturn / S/2006 S27` | S/2006 S27 | not-started | orbit-context-only | SAT455 / 65174 |
| `Saturn / S/2006 S28` | S/2006 S28 | not-started | orbit-context-only | SAT455 / 65175 |
| `Saturn / S/2006 S29` | S/2006 S29 | not-started | orbit-context-only | SAT455 / 65176 |
| `Saturn / S/2007 S2` | S/2007 S2 | not-started | orbit-context-only | SAT457 / 65091 |
| `Saturn / S/2007 S3` | S/2007 S3 | not-started | orbit-context-only | SAT457 / 65092 |
| `Saturn / S/2007 S5` | S/2007 S5 | not-started | orbit-context-only | SAT457 / 65101 |
| `Saturn / S/2007 S6` | S/2007 S6 | not-started | orbit-context-only | SAT457 / 65107 |
| `Saturn / S/2007 S7` | S/2007 S7 | not-started | orbit-context-only | SAT457 / 65130 |
| `Saturn / S/2007 S8` | S/2007 S8 | not-started | orbit-context-only | SAT457 / 65131 |
| `Saturn / S/2007 S9` | S/2007 S9 | not-started | orbit-context-only | SAT457 / 65153 |
| `Saturn / S/2007 S10` | S/2007 S10 | not-started | orbit-context-only | SAT455 / 65177 |
| `Saturn / S/2007 S11` | S/2007 S11 | not-started | orbit-context-only | SAT455 / 65178 |
| `Saturn / S/2009 S1` | S/2009 S1 | not-started | observation-candidate | historical detection only / unestablished |
| `Saturn / S/2009 S2` | S/2009 S2 | not-started | observation-candidate | SAT480 / 65304 |
| `Saturn / S/2019 S1` | S/2019 S1 | not-started | orbit-context-only | SAT457 / 65093 |
| `Saturn / S/2019 S2` | S/2019 S2 | not-started | orbit-context-only | SAT457 / 65094 |
| `Saturn / S/2019 S3` | S/2019 S3 | not-started | orbit-context-only | SAT457 / 65095 |
| `Saturn / S/2019 S4` | S/2019 S4 | not-started | orbit-context-only | SAT457 / 65103 |
| `Saturn / S/2019 S5` | S/2019 S5 | not-started | orbit-context-only | SAT457 / 65110 |
| `Saturn / S/2019 S6` | S/2019 S6 | not-started | orbit-context-only | SAT457 / 65116 |
| `Saturn / S/2019 S7` | S/2019 S7 | not-started | orbit-context-only | SAT457 / 65118 |
| `Saturn / S/2019 S8` | S/2019 S8 | not-started | orbit-context-only | SAT457 / 65119 |
| `Saturn / S/2019 S9` | S/2019 S9 | not-started | orbit-context-only | SAT457 / 65120 |
| `Saturn / S/2019 S10` | S/2019 S10 | not-started | orbit-context-only | SAT457 / 65122 |
| `Saturn / S/2019 S11` | S/2019 S11 | not-started | orbit-context-only | SAT457 / 65124 |
| `Saturn / S/2019 S12` | S/2019 S12 | not-started | orbit-context-only | SAT457 / 65126 |
| `Saturn / S/2019 S13` | S/2019 S13 | not-started | orbit-context-only | SAT457 / 65128 |
| `Saturn / S/2019 S14` | S/2019 S14 | not-started | orbit-context-only | SAT457 / 65133 |
| `Saturn / S/2019 S15` | S/2019 S15 | not-started | orbit-context-only | SAT457 / 65134 |
| `Saturn / S/2019 S16` | S/2019 S16 | not-started | orbit-context-only | SAT457 / 65144 |
| `Saturn / S/2019 S17` | S/2019 S17 | not-started | orbit-context-only | SAT457 / 65145 |
| `Saturn / S/2019 S18` | S/2019 S18 | not-started | orbit-context-only | SAT457 / 65146 |
| `Saturn / S/2019 S19` | S/2019 S19 | not-started | orbit-context-only | SAT457 / 65147 |
| `Saturn / S/2019 S20` | S/2019 S20 | not-started | orbit-context-only | SAT457 / 65148 |
| `Saturn / S/2019 S21` | S/2019 S21 | not-started | orbit-context-only | SAT457 / 65156 |
| `Saturn / S/2019 S22` | S/2019 S22 | not-started | orbit-context-only | SAT455 / 65179 |
| `Saturn / S/2019 S23` | S/2019 S23 | not-started | orbit-context-only | SAT455 / 65180 |
| `Saturn / S/2019 S24` | S/2019 S24 | not-started | orbit-context-only | SAT455 / 65181 |
| `Saturn / S/2019 S25` | S/2019 S25 | not-started | orbit-context-only | SAT455 / 65182 |
| `Saturn / S/2019 S26` | S/2019 S26 | not-started | orbit-context-only | SAT455 / 65183 |
| `Saturn / S/2019 S27` | S/2019 S27 | not-started | orbit-context-only | SAT455 / 65184 |
| `Saturn / S/2019 S28` | S/2019 S28 | not-started | orbit-context-only | SAT455 / 65185 |
| `Saturn / S/2019 S29` | S/2019 S29 | not-started | orbit-context-only | SAT455 / 65186 |
| `Saturn / S/2019 S30` | S/2019 S30 | not-started | orbit-context-only | SAT455 / 65187 |
| `Saturn / S/2019 S31` | S/2019 S31 | not-started | orbit-context-only | SAT455 / 65188 |
| `Saturn / S/2019 S32` | S/2019 S32 | not-started | orbit-context-only | SAT455 / 65189 |
| `Saturn / S/2019 S33` | S/2019 S33 | not-started | orbit-context-only | SAT455 / 65190 |
| `Saturn / S/2019 S34` | S/2019 S34 | not-started | orbit-context-only | SAT455 / 65191 |
| `Saturn / S/2019 S35` | S/2019 S35 | not-started | orbit-context-only | SAT455 / 65192 |
| `Saturn / S/2019 S36` | S/2019 S36 | not-started | orbit-context-only | SAT455 / 65193 |
| `Saturn / S/2019 S37` | S/2019 S37 | not-started | orbit-context-only | SAT455 / 65194 |
| `Saturn / S/2019 S38` | S/2019 S38 | not-started | orbit-context-only | SAT455 / 65195 |
| `Saturn / S/2019 S39` | S/2019 S39 | not-started | orbit-context-only | SAT455 / 65196 |
| `Saturn / S/2019 S40` | S/2019 S40 | not-started | orbit-context-only | SAT455 / 65197 |
| `Saturn / S/2019 S41` | S/2019 S41 | not-started | orbit-context-only | SAT455 / 65198 |
| `Saturn / S/2019 S42` | S/2019 S42 | not-started | orbit-context-only | SAT455 / 65199 |
| `Saturn / S/2019 S43` | S/2019 S43 | not-started | orbit-context-only | SAT455 / 65200 |
| `Saturn / S/2019 S44` | S/2019 S44 | not-started | orbit-context-only | SAT455 / 65201 |
| `Saturn / S/2020 S1` | S/2020 S1 | not-started | orbit-context-only | SAT457 / 65096 |
| `Saturn / S/2020 S2` | S/2020 S2 | not-started | orbit-context-only | SAT457 / 65097 |
| `Saturn / S/2020 S3` | S/2020 S3 | not-started | orbit-context-only | SAT457 / 65102 |
| `Saturn / S/2020 S4` | S/2020 S4 | not-started | orbit-context-only | SAT457 / 65105 |
| `Saturn / S/2020 S5` | S/2020 S5 | not-started | orbit-context-only | SAT457 / 65106 |
| `Saturn / S/2020 S6` | S/2020 S6 | not-started | orbit-context-only | SAT457 / 65127 |
| `Saturn / S/2020 S7` | S/2020 S7 | not-started | orbit-context-only | SAT457 / 65132 |
| `Saturn / S/2020 S8` | S/2020 S8 | not-started | orbit-context-only | SAT457 / 65140 |
| `Saturn / S/2020 S9` | S/2020 S9 | not-started | orbit-context-only | SAT457 / 65151 |
| `Saturn / S/2020 S10` | S/2020 S10 | not-started | orbit-context-only | SAT457 / 65155 |
| `Saturn / S/2020 S11` | S/2020 S11 | not-started | orbit-context-only | SAT455 / 65202 |
| `Saturn / S/2020 S12` | S/2020 S12 | not-started | orbit-context-only | SAT455 / 65203 |
| `Saturn / S/2020 S13` | S/2020 S13 | not-started | orbit-context-only | SAT455 / 65204 |
| `Saturn / S/2020 S14` | S/2020 S14 | not-started | orbit-context-only | SAT455 / 65205 |
| `Saturn / S/2020 S15` | S/2020 S15 | not-started | orbit-context-only | SAT455 / 65206 |
| `Saturn / S/2020 S16` | S/2020 S16 | not-started | orbit-context-only | SAT455 / 65207 |
| `Saturn / S/2020 S17` | S/2020 S17 | not-started | orbit-context-only | SAT455 / 65208 |
| `Saturn / S/2020 S18` | S/2020 S18 | not-started | orbit-context-only | SAT455 / 65209 |
| `Saturn / S/2020 S19` | S/2020 S19 | not-started | orbit-context-only | SAT455 / 65210 |
| `Saturn / S/2020 S20` | S/2020 S20 | not-started | orbit-context-only | SAT455 / 65211 |
| `Saturn / S/2020 S21` | S/2020 S21 | not-started | orbit-context-only | SAT455 / 65212 |
| `Saturn / S/2020 S22` | S/2020 S22 | not-started | orbit-context-only | SAT455 / 65213 |
| `Saturn / S/2020 S23` | S/2020 S23 | not-started | orbit-context-only | SAT455 / 65214 |
| `Saturn / S/2020 S24` | S/2020 S24 | not-started | orbit-context-only | SAT455 / 65215 |
| `Saturn / S/2020 S25` | S/2020 S25 | not-started | orbit-context-only | SAT455 / 65216 |
| `Saturn / S/2020 S26` | S/2020 S26 | not-started | orbit-context-only | SAT455 / 65217 |
| `Saturn / S/2020 S27` | S/2020 S27 | not-started | orbit-context-only | SAT455 / 65218 |
| `Saturn / S/2020 S28` | S/2020 S28 | not-started | orbit-context-only | SAT455 / 65219 |
| `Saturn / S/2020 S29` | S/2020 S29 | not-started | orbit-context-only | SAT455 / 65220 |
| `Saturn / S/2020 S30` | S/2020 S30 | not-started | orbit-context-only | SAT455 / 65221 |
| `Saturn / S/2020 S31` | S/2020 S31 | not-started | orbit-context-only | SAT455 / 65222 |
| `Saturn / S/2020 S32` | S/2020 S32 | not-started | orbit-context-only | SAT455 / 65223 |
| `Saturn / S/2020 S33` | S/2020 S33 | not-started | orbit-context-only | SAT455 / 65224 |
| `Saturn / S/2020 S34` | S/2020 S34 | not-started | orbit-context-only | SAT455 / 65225 |
| `Saturn / S/2020 S35` | S/2020 S35 | not-started | orbit-context-only | SAT455 / 65226 |
| `Saturn / S/2020 S36` | S/2020 S36 | not-started | orbit-context-only | SAT455 / 65227 |
| `Saturn / S/2020 S37` | S/2020 S37 | not-started | orbit-context-only | SAT455 / 65228 |
| `Saturn / S/2020 S38` | S/2020 S38 | not-started | orbit-context-only | SAT455 / 65229 |
| `Saturn / S/2020 S39` | S/2020 S39 | not-started | orbit-context-only | SAT455 / 65230 |
| `Saturn / S/2020 S40` | S/2020 S40 | not-started | orbit-context-only | SAT455 / 65231 |
| `Saturn / S/2020 S41` | S/2020 S41 | not-started | orbit-context-only | SAT455 / 65232 |
| `Saturn / S/2020 S42` | S/2020 S42 | not-started | orbit-context-only | SAT455 / 65233 |
| `Saturn / S/2020 S43` | S/2020 S43 | not-started | orbit-context-only | SAT455 / 65234 |
| `Saturn / S/2020 S44` | S/2020 S44 | not-started | orbit-context-only | SAT455 / 65235 |
| `Saturn / S/2020 S45` | S/2020 S45 | not-started | orbit-context-only | SAT459 / 65286 |
| `Saturn / S/2020 S46` | S/2020 S46 | not-started | orbit-context-only | SAT459 / 65287 |
| `Saturn / S/2020 S47` | S/2020 S47 | not-started | orbit-context-only | SAT459 / 65288 |
| `Saturn / S/2020 S48` | S/2020 S48 | not-started | orbit-context-only | SAT459 / 65289 |
| `Saturn / S/2020 S49` | S/2020 S49 | not-started | orbit-context-only | SAT459 / 65297 |
| `Saturn / S/2023 S1` | S/2023 S1 | not-started | orbit-context-only | SAT455 / 65236 |
| `Saturn / S/2023 S2` | S/2023 S2 | not-started | orbit-context-only | SAT455 / 65237 |
| `Saturn / S/2023 S3` | S/2023 S3 | not-started | orbit-context-only | SAT455 / 65238 |
| `Saturn / S/2023 S4` | S/2023 S4 | not-started | orbit-context-only | SAT455 / 65239 |
| `Saturn / S/2023 S5` | S/2023 S5 | not-started | orbit-context-only | SAT455 / 65240 |
| `Saturn / S/2023 S6` | S/2023 S6 | not-started | orbit-context-only | SAT455 / 65241 |
| `Saturn / S/2023 S7` | S/2023 S7 | not-started | orbit-context-only | SAT455 / 65242 |
| `Saturn / S/2023 S8` | S/2023 S8 | not-started | orbit-context-only | SAT455 / 65243 |
| `Saturn / S/2023 S9` | S/2023 S9 | not-started | orbit-context-only | SAT455 / 65244 |
| `Saturn / S/2023 S10` | S/2023 S10 | not-started | orbit-context-only | SAT455 / 65245 |
| `Saturn / S/2023 S11` | S/2023 S11 | not-started | orbit-context-only | SAT455 / 65246 |
| `Saturn / S/2023 S12` | S/2023 S12 | not-started | orbit-context-only | SAT455 / 65247 |
| `Saturn / S/2023 S13` | S/2023 S13 | not-started | orbit-context-only | SAT455 / 65248 |
| `Saturn / S/2023 S14` | S/2023 S14 | not-started | orbit-context-only | SAT455 / 65249 |
| `Saturn / S/2023 S15` | S/2023 S15 | not-started | orbit-context-only | SAT455 / 65250 |
| `Saturn / S/2023 S16` | S/2023 S16 | not-started | orbit-context-only | SAT455 / 65251 |
| `Saturn / S/2023 S17` | S/2023 S17 | not-started | orbit-context-only | SAT455 / 65252 |
| `Saturn / S/2023 S18` | S/2023 S18 | not-started | orbit-context-only | SAT455 / 65253 |
| `Saturn / S/2023 S19` | S/2023 S19 | not-started | orbit-context-only | SAT455 / 65254 |
| `Saturn / S/2023 S20` | S/2023 S20 | not-started | orbit-context-only | SAT455 / 65255 |
| `Saturn / S/2023 S21` | S/2023 S21 | not-started | orbit-context-only | SAT455 / 65256 |
| `Saturn / S/2023 S22` | S/2023 S22 | not-started | orbit-context-only | SAT455 / 65257 |
| `Saturn / S/2023 S23` | S/2023 S23 | not-started | orbit-context-only | SAT455 / 65258 |
| `Saturn / S/2023 S24` | S/2023 S24 | not-started | orbit-context-only | SAT455 / 65259 |
| `Saturn / S/2023 S25` | S/2023 S25 | not-started | orbit-context-only | SAT455 / 65260 |
| `Saturn / S/2023 S26` | S/2023 S26 | not-started | orbit-context-only | SAT455 / 65261 |
| `Saturn / S/2023 S27` | S/2023 S27 | not-started | orbit-context-only | SAT455 / 65262 |
| `Saturn / S/2023 S28` | S/2023 S28 | not-started | orbit-context-only | SAT455 / 65263 |
| `Saturn / S/2023 S29` | S/2023 S29 | not-started | orbit-context-only | SAT455 / 65264 |
| `Saturn / S/2023 S30` | S/2023 S30 | not-started | orbit-context-only | SAT455 / 65265 |
| `Saturn / S/2023 S31` | S/2023 S31 | not-started | orbit-context-only | SAT455 / 65266 |
| `Saturn / S/2023 S32` | S/2023 S32 | not-started | orbit-context-only | SAT455 / 65267 |
| `Saturn / S/2023 S33` | S/2023 S33 | not-started | orbit-context-only | SAT455 / 65268 |
| `Saturn / S/2023 S34` | S/2023 S34 | not-started | orbit-context-only | SAT455 / 65269 |
| `Saturn / S/2023 S35` | S/2023 S35 | not-started | orbit-context-only | SAT455 / 65270 |
| `Saturn / S/2023 S36` | S/2023 S36 | not-started | orbit-context-only | SAT455 / 65271 |
| `Saturn / S/2023 S37` | S/2023 S37 | not-started | orbit-context-only | SAT455 / 65272 |
| `Saturn / S/2023 S38` | S/2023 S38 | not-started | orbit-context-only | SAT455 / 65273 |
| `Saturn / S/2023 S39` | S/2023 S39 | not-started | orbit-context-only | SAT455 / 65274 |
| `Saturn / S/2023 S40` | S/2023 S40 | not-started | orbit-context-only | SAT455 / 65275 |
| `Saturn / S/2023 S41` | S/2023 S41 | not-started | orbit-context-only | SAT455 / 65276 |
| `Saturn / S/2023 S42` | S/2023 S42 | not-started | orbit-context-only | SAT455 / 65277 |
| `Saturn / S/2023 S43` | S/2023 S43 | not-started | orbit-context-only | SAT455 / 65278 |
| `Saturn / S/2023 S44` | S/2023 S44 | not-started | orbit-context-only | SAT455 / 65279 |
| `Saturn / S/2023 S45` | S/2023 S45 | not-started | orbit-context-only | SAT455 / 65280 |
| `Saturn / S/2023 S46` | S/2023 S46 | not-started | orbit-context-only | SAT455 / 65281 |
| `Saturn / S/2023 S47` | S/2023 S47 | not-started | orbit-context-only | SAT455 / 65282 |
| `Saturn / S/2023 S48` | S/2023 S48 | not-started | orbit-context-only | SAT455 / 65283 |
| `Saturn / S/2023 S49` | S/2023 S49 | not-started | orbit-context-only | SAT455 / 65284 |
| `Saturn / S/2023 S50` | S/2023 S50 | not-started | orbit-context-only | SAT455 / 65285 |
| `Saturn / S/2023 S51` | S/2023 S51 | not-started | orbit-context-only | SAT459 / 65290 |
| `Saturn / S/2023 S52` | S/2023 S52 | not-started | orbit-context-only | SAT459 / 65291 |
| `Saturn / S/2023 S53` | S/2023 S53 | not-started | orbit-context-only | SAT459 / 65292 |
| `Saturn / S/2023 S54` | S/2023 S54 | not-started | orbit-context-only | SAT459 / 65293 |
| `Saturn / S/2023 S55` | S/2023 S55 | not-started | orbit-context-only | SAT459 / 65294 |
| `Saturn / S/2023 S56` | S/2023 S56 | not-started | orbit-context-only | SAT459 / 65295 |
| `Saturn / S/2023 S57` | S/2023 S57 | not-started | orbit-context-only | SAT459 / 65296 |
| `Saturn / S/2023 S58` | S/2023 S58 | not-started | orbit-context-only | SAT459 / 65298 |
| `Saturn / S/2023 S59` | S/2023 S59 | not-started | orbit-context-only | SAT459 / 65299 |
| `Saturn / S/2023 S60` | S/2023 S60 | not-started | orbit-context-only | SAT459 / 65300 |
| `Saturn / S/2023 S61` | S/2023 S61 | not-started | orbit-context-only | SAT459 / 65301 |
| `Saturn / S/2023 S62` | S/2023 S62 | not-started | orbit-context-only | SAT459 / 65302 |
| `Saturn / S/2023 S63` | S/2023 S63 | not-started | orbit-context-only | SAT459 / 65303 |

## Limits

- This completes a bounded per-body source-feasibility review, not package qualification. No source baking, runtime fit, browser visual comparison, build, test or PR was performed.
- Catalog and ephemeris inventories change and disagree at their publication boundaries. The frozen input has 293 Saturn rows; actual SAT459/SAT480 comments resolve the documented omissions without expanding the input.
- All 231 rows with an MPEC reference were matched in all 96 distinct actual notices. Other rows retain JPL IAU/IAUC references and body-specific physical/mission evidence; inaccessible or unqueried IAU circular text is not represented as read.
- The 122-irregular physical table has exact entries for 122 input bodies, leaving 146 irregular discoveries outside its scope. These rows were individually reconciled against discovery/ephemeris identifiers and the checked Cassini/shape product scope; this does not prove that no later observation exists.
- Every one of the 35 missing named moons received an individual author-page review; 25 total Cassini Table 3 members and all 28 existing package source/recipe/content/manifest choices were inspected. Some author estimated size/pole fields differ from publications; explicit table identity governs reported ratios and periods.
- Only metadata/small papers/numeric tables were retrieved. Tethys/Dione global subdirectory HTTP 403, Ymir native OBJ HTTP 404, Hyperion 2025 release identity and some MAST DOI resolutions remain concrete limits. Rhea actual OBJ names and small-moon numeric spectra were verified.
- No minimum axis ratio is assigned to Narvi or Kari. Lightcurve inversion constraints, approximate inferred shapes, mean/photometric radii, measured ellipsoids and native released meshes remain separate.
- Disk-integrated JWST spectra and Cassini lightcurves justify scientific charts or observation narratives, not spatial-color/composition textures. Spectral numeric units, uncertainties and wavelength cuts require implementation qualification.
- No published global color-filled Titan composite is promoted as fully observed. Sparse Titan topography and its interpolation are separate products; Iapetus/Enceladus forthcoming SPC announcements are not releases.
- Source SPK time coverage is a file interval, not an accuracy claim. SAT415 ends in 2018; package-specific fitted previews and historical pole conventions must not inherit broad source validity.

Complete source ledger and access states: [saturn-review.json](./saturn-review.json). No implementation, PR, commit, worktree, build or large data download was created.
