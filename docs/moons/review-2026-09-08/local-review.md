# Local moon source review

All four existing local-system scenes have specific evidence-backed depth opportunities. The strongest shared implementation path is matching-mesh scalar preparation for Dimorphos, Phobos and Deimos; the Moon offers native numeric DEM and Diviner products. Deimos EXI 2026 is explicitly an unresolved data-release lead.

Reviewed 2026-09-08 against the frozen merged implementation; 4/4 assigned rows.

## Moon

**improve-existing · large effort · high confidence**

**geometry:** Current 16-band reference sphere, radius 1737.4 km; topography is displayed as a print-map lens. Native LOLA/SLDEM numeric heights are released and could support preparation of actual relief with bounded simplification. SLDEM supports equatorial/midlatitude terrain; polar coverage requires the appropriate separate LOLA product.

**imagery:** Existing 2k NASA visualization color plus LOLA/GRAIL print JPGs with baked shaded relief. GRAIL crustal thickness is gravity-inferred under a uniform crust-density assumption. NASA current color includes polar monochrome substitution and gap filling. Diviner RA/soil-temperature/RMS products cover 60 degrees south to 60 degrees north at 32 ppd in ten local-hour bins from 19:30 through 05:30; they are scientific layers, not photographs or a full-globe instantaneous thermal map.

**orbit:** NAIF 301; merged solar geometry prepares an ELP Moon state at JD 2461286.5. Legacy SOURCE prose describes mean context and needs reconciliation with current code; no orbit implementation rerun.

**supportedRepresentation:** Numeric topography and a carefully labeled Diviner thermal, rock-abundance or composition-proxy lens on the existing standalone Moon; lunar-hour bins and coverage visible in content. Optional genuine prepared relief after error/budget review.

**nextAction:** Pin one Diviner GDR product with label/units/missing-data mask and native LOLA DEM; replace print-based elevation intake, qualify a new scientific layer, and correct stale orbit provenance.

**blocker:** Selected raster labels and validity masks still need full intake; thermal local time is not the shared instantaneous scene date. Global imagery color includes reconstructed regions. No runtime or visual qualification performed.

**effortReason:** Numeric scalar intake, legend/coverage semantics and relief preparation are broader than swapping an image; start with one well-defined lens.

Evidence: [Moon merged package SOURCE and preparation/content](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/planets/moon/SOURCE.md), [Merged shared solar geometry](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/platform/solar-geometry.mjs), [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), [NASA lunar topography and crustal-thickness maps](https://svs.gsfc.nasa.gov/4014/), [PDS LOLA/SLDEM2015 native float products](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/sldem2015/global/float_img/), [PDS Diviner derived collection label](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gdr_l3/collection_data_derived_gdr_level3.xml), [ODE Diviner Level 3 product guide](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/Lunar%20Reconnaissance%20Orbiter%20%28LRO%29/DIVINER/GDR_L3.htm)

## Phobos

**improve-existing · medium effort · high confidence**

**geometry:** Ernst/SBMT v004 148 m model already supplies geometry, reduced to 1216 display facets. Higher-density releases exist; useful improvement depends on measured silhouette/relief gain, not file size. Frame label explicitly migrated PCK10 to PCK11 and removed COM/COF offset.

**imagery:** Controlled 40 ppd Stooke multi-mission mosaic already present; nominal ~5 m pixels are not uniform 5 m detail. Companion facet-relative-albedo and geophysical attributes are released. Regional color and disk spectra require their own coverage/registration work.

**orbit:** NAIF 401 relative to Mars 499; merged code retains a Horizons geometric state at shared epoch, alongside IAU rotation. Release model-frame consistency still needs a future visual/coordinate audit.

**supportedRepresentation:** Existing observed mosaic plus separately labeled SPC relative-albedo or modeled gravity/slope lens, preserving source coverage and assumptions. A spectral chart is a later research candidate.

**nextAction:** Use the matching v004 CSV attributes and model label to qualify one facet-scalar layer; compare source support and frame conventions before considering denser geometry.

**blocker:** Facet attributes must preserve mesh identity and validity through preparation. Gravity/slope assumes density, rotation and Mars position; existing lit mosaic cannot be relabeled as albedo. New regional image registration and PSA spectrum product identity remain unresolved.

**effortReason:** Matching geometry and attributes already exist; shared facet-scalar preparation and visual checks remain. Regional image or spectral work would be separate research.

Evidence: [Phobos merged package SOURCE and preparation/content](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/planets/phobos/SOURCE.md), [Merged shared solar geometry](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/platform/solar-geometry.mjs), [Ernst et al. 2023 Phobos and Deimos SPC models](https://pmc.ncbi.nlm.nih.gov/articles/PMC10290967/), [SBMT actual shared-file release index](https://sbmt.jhuapl.edu/shared-files/), [Phobos v004 148 m release label](https://sbmt.jhuapl.edu/shared-files/files/phobos_g_148m_spc_obj_0000n00000_v004.lbl), [USGS Phobos controlled mosaic record](https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m), [TGO NOMAD-UVIS Mars-moon reflectance study](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/2023JE008002)

## Deimos

**improve-existing · medium effort · high confidence**

**geometry:** Ernst/SBMT v002 83 m model already used with 1216 display facets. Detailed SPC support is limited to part of the body; limb-constrained closure elsewhere is not equal-quality topography.

**imagery:** Existing 20 ppd Viking/MRO mosaic includes coarse coverage, lit terrain, seam/polar interpolation and no source validity mask. The matching v002 facet attributes are released. July 2026 EXI crater/boulder paper is a new lead, but its registered feature-data release could not be verified.

**orbit:** NAIF 402; current package uses prepared Mars-relative compact orbit and IAU orientation at shared date. A fresh reference fit was not performed.

**supportedRepresentation:** Coverage-aware SPC scalar lens on current geometry; later registered EXI regional observation/feature view if calibrated sequences, geometry and data release are obtained. Disk spectra would support a chart, not a fabricated global color map.

**nextAction:** Qualify one matching v002 facet-scalar layer and preserve the existing conservative NaN-albedo support mask; resolve the 2026 EXI paper data availability and exact EMM Deimos sequence before committing to an image/feature layer.

**blocker:** Sparse SPC support and incomplete mosaic validity are material. New EXI paper full text returned 403; actual mapped crater/boulder release and image-to-shape geometry are unverified. A catalog entry or press image does not resolve registration.

**effortReason:** Existing matching mesh/CSV permits bounded scalar work; EXI feature/imagery extension remains separate research and may be large.

Evidence: [Deimos merged package SOURCE and preparation/content](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/planets/deimos/SOURCE.md), [Merged shared solar geometry](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/platform/solar-geometry.mjs), [Ernst et al. 2023 Phobos and Deimos SPC models](https://pmc.ncbi.nlm.nih.gov/articles/PMC10290967/), [SBMT actual shared-file release index](https://sbmt.jhuapl.edu/shared-files/), [Deimos v002 83 m release label](https://sbmt.jhuapl.edu/shared-files/files/deimos_g_083m_spc_obj_0000n00000_v002.lbl), [PDS Stooke maps archive](https://sbn.psi.edu/pds/resource/stookemaps.html), [Shimizu et al. 2026 EXI Deimos crater and boulder distribution](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2025GL117346), [Emirates Mars Mission Science Data Center](https://sdc.emiratesmarsmission.ae/), [TGO NOMAD-UVIS Mars-moon reflectance study](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/2023JE008002)

## Dimorphos

**improve-existing · medium effort · high confidence**

**geometry:** Released DART v004 pre-impact .972 m SPC global mesh is already reduced to 800 display facets. Encounter mesh includes modeled terrain; simplifier error is separate from observational uncertainty. It cannot be presented as a measured post-impact shape.

**imagery:** No photographic map is currently mounted. Actual v004 FITS binary-table release has per-facet relative albedo and sigma; gravity-relative slope is also released on the same 196608 facets. These provide a concrete path without first solving photographic frame projection.

**orbit:** Existing DART s547 post-impact relative-trajectory fit uses a stated 60-day window; SOURCE records prior six-sample fit errors, not rerun here. The shape is pre-impact and display phase about the measured pole is arbitrary; no coupled post-impact attitude prediction is established.

**supportedRepresentation:** Encounter-era relative-albedo and separately labeled gravity-relative slope views, retaining mesh-aligned valid/unknown support. Keep encounter shape, post-impact orbital context and arbitrary display phase distinct.

**nextAction:** Add preparation support for the released v004 FITS facet table, join by FACET_NUM to the exact model, preserve sigma/no-data semantics and qualify a relative-albedo lens; slope follows with explicit density/rotation/Didymos assumptions.

**blocker:** Existing cylindrical FITS path cannot ingest facet tables. A nonempty scalar or sigma alone does not prove observed coverage, and attributes must survive simplification without inventing detail. No future shape, spin or post-impact surface inferred.

**effortReason:** The actual registered ancillary products are released; a reusable facet-table preparation path and coverage/visual qualification are the main work.

Evidence: [Dimorphos merged package SOURCE and preparation/content](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/planets/dimorphos/SOURCE.md), [PDS DART Dimorphos v004 collection](https://pds.nasa.gov/ds-view/pds/viewCollection.jsp?identifier=urn:nasa:pds:dart_shapemodel:data_derived_dimorphos_model_v004), [Dimorphos v004 relative-albedo table label](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/data_derived_dimorphos_model_v004/dimorphos_g_0972mm_spc_alb_0000n00000_v004.xml), [Dimorphos v004 gravity-relative slope label](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/data_derived_dimorphos_model_v004/dimorphos_g_0972mm_spc_slp_0000n00000_v004.xml), [DART shape-model software interface specification](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/document/dart_shapemodel_sis.pdf)

## Limits

- Review establishes feasible source directions, not qualified new assets, runtime correctness or release readiness.
- Only small metadata/labels and the DART SIS were downloaded. Raster/mesh arrays and full ancillary validity have not been recomputed.
- Mixed source epochs, frames, terrain support and visualization color treatments must remain explicit.
- No new PR, implementation, build, tests, large source bake or external publication was performed.

## Source ledger

### local-moon-package

[Moon merged package SOURCE and preparation/content](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/planets/moon/SOURCE.md) · read · checked 2026-09-08

Read SOURCE.md, content and preparation recipes from equivalent implementation commit 7b289887; these establish what is already implemented, not fresh release qualification.

Scope: Moon

### local-phobos-package

[Phobos merged package SOURCE and preparation/content](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/planets/phobos/SOURCE.md) · read · checked 2026-09-08

Read SOURCE.md, content and preparation recipes from equivalent implementation commit 7b289887; these establish what is already implemented, not fresh release qualification.

Scope: Phobos

### local-deimos-package

[Deimos merged package SOURCE and preparation/content](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/planets/deimos/SOURCE.md) · read · checked 2026-09-08

Read SOURCE.md, content and preparation recipes from equivalent implementation commit 7b289887; these establish what is already implemented, not fresh release qualification.

Scope: Deimos

### local-dimorphos-package

[Dimorphos merged package SOURCE and preparation/content](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/planets/dimorphos/SOURCE.md) · read · checked 2026-09-08

Read SOURCE.md, content and preparation recipes from equivalent implementation commit 7b289887; these establish what is already implemented, not fresh release qualification.

Scope: Dimorphos

### local-solar

[Merged shared solar geometry](https://github.com/layoutit/cssEarth/blob/554c9811314e363f1d68287586864d8540213145/src/platform/solar-geometry.mjs) · read · checked 2026-09-08

Shared epoch JD 2461286.5: Moon uses ELP; Phobos uses a retained Horizons state; compact moon orbits and source-defined body orientation are prepared. Source comments distinguish parent barycenters from centers.

Scope: Moon, Phobos, Deimos; body-specific states and limitations

### local-moon-kit

[NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) · read · checked 2026-09-08

The current color release mixes WAC color with monochrome polar information and gap filling. Numeric LOLA displacement products are also linked. The existing recipe uses a 2k image and print-map topography/crust inputs.

Scope: Moon surface and numeric height; visualization color is not a calibrated albedo map

### local-moon-print

[NASA lunar topography and crustal-thickness maps](https://svs.gsfc.nasa.gov/4014/) · read · checked 2026-09-08

Both flat print maps contain baked shaded relief. GRAIL crustal thickness is a gravity-inferred model with a uniform crust-density assumption, not a direct thickness measurement.

Scope: Moon existing display-map interpretation

### local-lola

[PDS LOLA/SLDEM2015 native float products](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/sldem2015/global/float_img/) · read · checked 2026-09-08

Actual release directory exposes native float images and labels; datum, scale and spatial coverage must be taken from the selected label before preparation. No raster downloaded.

Scope: Moon numeric elevation

### local-diviner

[PDS Diviner derived collection label](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gdr_l3/collection_data_derived_gdr_level3.xml) · read · checked 2026-09-08

Label identifies Moon target and derived thermal, rock-abundance and silicate-mineralogy products, with observation span 2009-07-05 to 2016-10-23. Retained label and hash in local-evidence.

Scope: Moon Diviner GDR Level 3

### local-diviner-guide

[ODE Diviner Level 3 product guide](https://ode.rsl.wustl.edu/moon/pagehelp/Content/Missions_Instruments/Lunar%20Reconnaissance%20Orbiter%20%28LRO%29/DIVINER/GDR_L3.htm) · read · checked 2026-09-08

The guide distinguishes Christiansen Feature wavelength, rock abundance and fitted soil temperature/RMS. Thermal products use specified lunar-hour bins; coverage and missing-data handling vary by product.

Scope: Moon composition proxy, rock abundance and local-time-conditioned thermal views

### local-ernst

[Ernst et al. 2023 Phobos and Deimos SPC models](https://pmc.ncbi.nlm.nih.gov/articles/PMC10290967/) · read · checked 2026-09-08

Released SPC models include relative albedo and modeled gravity/slope attributes. Detailed SPC support is much less complete on Deimos; a closed mesh does not imply uniform measurement. Gravity interpretation includes density and Mars assumptions.

Scope: Phobos and Deimos geometry and facet attributes

### local-sbmt

[SBMT actual shared-file release index](https://sbmt.jhuapl.edu/shared-files/) · read · checked 2026-09-08

Index read through direct HTTP: Phobos v004 and Deimos v002 OBJ and matching CSV products are individually linked at several spacings. Phobos 18 m CSV is explicitly draft. No large archive downloaded.

Scope: Phobos v004; Deimos v002

### local-phobos-label

[Phobos v004 148 m release label](https://sbmt.jhuapl.edu/shared-files/files/phobos_g_148m_spc_obj_0000n00000_v004.lbl) · read · checked 2026-09-08

Label names the matching OBJ, migration from PCK10 to PCK11, removal of COM/COF offset, density, rotation and assumed Mars position. Retained with hash.

Scope: Phobos v004 frame and geophysical assumptions

### local-deimos-label

[Deimos v002 83 m release label](https://sbmt.jhuapl.edu/shared-files/files/deimos_g_083m_spc_obj_0000n00000_v002.lbl) · read · checked 2026-09-08

Label names the matching OBJ, 2025-03-10 release, nominal spacing, bulk density, spin and assumed Mars position. Retained with hash.

Scope: Deimos v002 model identity and geophysical assumptions

### local-phobos-map

[USGS Phobos controlled mosaic record](https://astrogeology.usgs.gov/search/map/phobos_viking_global_mosaic_5m) · read · checked 2026-09-08

DLR-controlled Stooke mosaic already used in cssEarth. Nominal pixel spacing does not establish uniform image resolution; source illumination and artistic seam adjustment remain.

Scope: Phobos observation mosaic

### local-stooke

[PDS Stooke maps archive](https://sbn.psi.edu/pds/resource/stookemaps.html) · read · checked 2026-09-08

The retained Deimos cylindrical Viking/MRO mosaic belongs to this release. Current package already records interpolated polar areas and absence of a supplied validity mask.

Scope: Deimos existing mosaic; broader archive does not imply every map is a measured complete surface

### local-exi-paper

[Shimizu et al. 2026 EXI Deimos crater and boulder distribution](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2025GL117346) · metadata-only · checked 2026-09-08

Abstract, published 2026-07-18, reports crater and boulder distributions from Hope EXI, including poorly observed areas. Full-text/data-availability endpoint returned 403; a downloadable registered feature catalog was not established.

Scope: Deimos new morphology lead

### local-emm

[Emirates Mars Mission Science Data Center](https://sdc.emiratesmarsmission.ae/) · metadata-only · checked 2026-09-08

Primary science-data portal identified for EXI/EMIRS/EMUS observations; no specific Deimos calibrated sequence and complete geometry release selected in this review.

Scope: Deimos mission-data access lead

### local-nomad

[TGO NOMAD-UVIS Mars-moon reflectance study](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/2023JE008002) · metadata-only · checked 2026-09-08

Paper identifies ultraviolet/visible reflectance observations of both moons; this is a disk-spectrum/chart lead, not a registered global color texture. Exact PSA products remain to be pinned.

Scope: Phobos and Deimos spectra

### local-dart

[PDS DART Dimorphos v004 collection](https://pds.nasa.gov/ds-view/pds/viewCollection.jsp?identifier=urn:nasa:pds:dart_shapemodel:data_derived_dimorphos_model_v004) · read · checked 2026-09-08

Released final pre-impact global SPC collection is already the geometry source. Archive model uncertainty must remain separate from display-mesh simplification error.

Scope: Dimorphos encounter-era v004 geometry

### local-dart-albedo

[Dimorphos v004 relative-albedo table label](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/data_derived_dimorphos_model_v004/dimorphos_g_0972mm_spc_alb_0000n00000_v004.xml) · read · checked 2026-09-08

Actual label has 196608 facet records with facet number, latitude, longitude, radius in km, relative albedo and sigma. It is a FITS binary table, not a cylindrical image. Retained with hash.

Scope: Dimorphos v004 .972 m matching-facet relative albedo

### local-dart-slope

[Dimorphos v004 gravity-relative slope label](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/data_derived_dimorphos_model_v004/dimorphos_g_0972mm_spc_slp_0000n00000_v004.xml) · read · checked 2026-09-08

Actual 196608-record table supplies slope and sigma in degrees. Label specifies uniform density, rotation and Didymos gravitational influence. This is distinct from radius-derived height.

Scope: Dimorphos modeled gravity-relative slope

### local-dart-sis

[DART shape-model software interface specification](https://pdssbn.astro.umd.edu/holdings/pds4-dart_shapemodel-v1.0/document/dart_shapemodel_sis.pdf) · read · checked 2026-09-08

Small PDF read: ancillary values correspond to plates of the matching shape; geophysical products use modeled gravity. Nominal global resolution does not establish useful detail everywhere.

Scope: DART shape and facet-product format and interpretation

