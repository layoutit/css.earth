# B3 source review: Callisto, Thebe, Dactyl and Selam

Reviewed 2026-09-09 against ef07fac2d3208e201dafc626374b30ed4644f561. This is source intake, not preparation/browser qualification. Existing source manifests, recipes and frozen reviews were inspected first. Exact source URLs, byte sizes, hashes and failed routes are in the companion JSON. No shared code or prepared body assets changed.

## Callisto

selected partial enhanced-band camera proof.

Selected products: C0605271600R, C0605271900R, C0605272200R.

- Original labels and OPUS identify GREEN/VIOLET/IR-9680; the LASP table third-band756 label is incorrect.
- All 3 IMG/LBL pairs acquired. Label geometry is west-positive, native800x800DN, May26,2001 near215W.

Required implementation evidence:

- I/F calibration or explicitly DN display
- per-camera landmark/limb holdout validation
- conservative common-band footprint

## Thebe

sixth Galileo candidate needs useful added coverage proof.

Selected products: C0420644201R.

- IMG/LBL and independent OPUS metadata acquired. 1997-Nov06 low phase9.658deg, subobserver22.404W,8.59557km/px.
- OPUS Thebe Sun32.020W; original label318.882W is stale/wrong target context.
- Current Juno SRU original archive lists only orbits36–80; newer May2026 press image has no closed camera/source pair.

Required implementation evidence:

- bounded registration proof over existing Stooke shape
- before/after area-weighted useful coverage

## Dactyl

source-constrained new ellipsoid plus encounter view feasible; orientation/current orbit unresolved.

Selected products: i2278.fit, i2278.lbl, idaidx.html.

- Original PDS index independently calls I2278 and I2700 highest-resolution Dactyl images.
- I2278 800x800byteDN decoded and visually verified; JPL caption supports39m/px and full1.6x1.4x1.2km.
- Ida calibrated bundle omits moon-onlyI2278 and its nadir workaround disables viewing geometry.

Required implementation evidence:

- I2700 independent holdout
- Dactyl-centered attitude/camera fit, not Ida label geometry
- no fabricated2026 orbitphase

## Selam

selected two-lobe model and partial Lucy registration proof.

Selected products: lor_0752129602_03610_00001_1x1_sci_03.fit, selam-departure.fit.

- Levison2024 fullinner240x200x200m and outer280x220x210m,10%per-axis estimates; neck/otherhemisphere unresolved.
- Two exact original10,526,400byte FITS acquired, decoded and visually verified including departure distinct lobes.
- Partially processed DN/s notI/F; XML pins primary/error/quality arrays and inertialWCS.
- Actual dinkinesh_v10PCK declares placeholder pole and oldspin/radii; reject as measured bodyorientation.

Required implementation evidence:

- source-pixel quality decode
- inertial camera + source-sized model fit, independent image holdout
- self-occlusion and conservative observedfootprint
- honest encounter-only/current scene contract

## Primary source routes

- Callisto exact products: https://opus.pds-rings.seti.org/holdings/volumes/GO_0xxx/GO_0023/C30/CALLISTO/; independent observation table https://lasp.colorado.edu/JUPITER/CH17/CallistoGLLSSI.pdf.
- Thebe original frame: https://opus.pds-rings.seti.org/holdings/volumes/GO_0xxx/GO_0020/E11/SML_SATS/C0420644201R.IMG; geometry https://opus.pds-rings.seti.org/opus/api/metadata/go-ssi-c0420644201.json.
- Dactyl original index and image: https://sbnarchive.psi.edu/pds3/galileo/idagaspra/sbnig_0001/data/galileo_ssi/ida/idaidx.html and same directory i2278.fit/i2278.lbl. Independent JPL dimensions/resolution: https://www.jpl.nasa.gov/images/pia00297-high-resolution-view-of-dactyl/.
- Selam source model: https://pmc.ncbi.nlm.nih.gov/articles/PMC11136651/. Exact Lucy collection: https://pdssbn.astro.umd.edu/holdings/pds4-lucy.llorri:data_dinkinesh_partially_processed-v1.0/. Camera: https://naif.jpl.nasa.gov/pub/naif/LUCY/kernels/ik/lcy_lorri_v03.ti. Placeholder body PCK to reject: https://naif.jpl.nasa.gov/pub/naif/LUCY/kernels/pck/dinkinesh_v10.tpc.

Original mission images retain NASA/JPL or NASA/GSFC/SwRI/JHU-APL attribution; Selam paper is CC BY 4.0. No third-party enhanced composite was adopted. Local original-source and display-only preview evidence is /tmp/b3-jupiter-companions (about32MB). No radiometric calibration or camera fit is implied by preview rendering.

Selam is selected first for a bounded two-lobe model and actual-camera proof. Root owns registry/astronomy and any shared preparation integration. Dactyl and Selam need honest treatment of encounter-only geometry; published sizes/periods alone cannot establish current orbital phase.
