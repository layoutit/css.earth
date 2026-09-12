# Combined image evidence and a measured velocity slit

The `joint-evidence@1` prototype adds two independent inspection views. It does not yet fit the fused map to a 3D cloud, connect it to the saved Helix shape recipe, or infer a unique depth. The next bridge is a connected ridge graph and a small set of shell/lobe hypotheses evaluated against both observations.

## Open the views

- `/reconstruction?subject=helix-model-prior&inspection=combined`: three registered ESO sources, their joint signal and agreement.
- `/reconstruction?subject=helix-model-prior&inspection=kinematics`: a real [O III] 5007 Å slit compared with an independent expanding shell.
- `/reconstruction?subject=helix-model-prior&fit=helix-tuned`: the earlier authored coarse 3D fit, retained separately.

Use the existing [lab startup](../README.md) and [Helix preparation](../models/helix/README.md) to restore aligned, star-separated observations. Opening Combined reuses those pinned working rasters; it never downloads new imagery, removes stars again or bakes a volume.

## Combined

**Broad / Ridges / Knots / All** select image responses at common angular scales. **Signal** shows the strongest eligible response, **Sources** colors it by contributing observation, and **Shared** shows compatible responses present in at least two observations. No consensus veto removes features visible in only one wavelength. A bright background star can also repeat across bands: agreement is not confirmed nebular membership.

- Slide Sensitivity or source weights to update automatically. Zero excludes a source from the comparison.
- Select the background photograph or hide it. These controls and overlay opacity only select/transport prepared pixels; they do not process data.
- Click a feature for its individual source scores. “No support” means missing footprint or insufficient supported neighborhood at that scale, not measured zero emission. Excluded sources are labeled separately.
- Pan, zoom and change background without changing registration. Saved Alignment inspection adjustments are included in the source-to-grid transforms; original measured registration is unchanged.
- Settings and server-owned jobs survive refresh. The old decoded map remains until the next result is ready. Interrupted server jobs are reported; Retry explicitly starts replacement work.

The source boundary checks source/map/panel hashes and uses the existing approximately 768-pixel NOX-derived working rasters. All complete footprints contribute to one north-up sky grid, including adjusted footprints outside the nominal frame. The current Helix grid samples about 4.69 arcsec per pixel. This is a quick structural comparison, not native-resolution filament recovery.

The independent TypeScript implementation uses separable Gaussian approximations, positive multiscale differences and Hessian ridge responses. Channels share angular smoothing scales, with a working-pixel blur proxy; actual instrumental PSFs are unknown. Each source is normalized against display-range and local noise proxies. Neither those proxies nor the composite RGB inputs are calibrated photometry. Different wavelengths are not forced to have equal brightness.

Kernel neighborhoods touching no-data are ineligible at that scale, avoiding photographic-edge ridges. Union is the maximum bounded weighted response. Agreement takes compatible pairwise minima within the same channel; ridge agreement also compares unoriented tangents. It does not infer depth or identify one physical feature across wavelengths. The full source remains inspectable where a large-scale response cannot be computed.

Generated input grids, image panels, contribution samples and receipts are ignored under `.local/nebula-lab/evidence-fusion/`. The input cache identity includes source pins, transforms and implementation owners. Runtime receives PNGs and prepared point-query values; source analysis runs in a child worker behind the existing durable job service.

**Visual limit:** the irregular main rim and outer northwest arc survive, while several residual stellar halos remain. Bright rim responses can saturate. Selecting ridges/adjusting sensitivity helps inspection; it does not repair star separation or prove a correct 3D form.

## Velocity

The source recipe retains 27 sparse centroid readings from **Meaburn et al. 2005, figure 9**, each in the exact published raster pixel coordinates with two-axis calibration anchors. Four core velocity components are retained, including those that the simple model cannot explain. These are digitized readings, not original FITS spectra. The assumed 1.5-pixel readout precision is distinct from statistical measurement errors and the shared systemic-velocity uncertainty. See the source recipe and original figure through the evidence disclosure in the app.

The [Helix preparation sequence](../models/helix/README.md) includes the figure-restoration command. It downloads the pinned paper source archive, checks archive/member hashes, decodes its embedded JPEG and verifies the figure hash. A replay into an empty temporary cache reproduced the original figure bytes; no published figure or generated chart is committed.

The server predicts the two line-of-sight intersections of a thin, optically thin ellipsoid with outward homologous expansion. Polar/equatorial ratio and inclination alter the assumed 3D geometry; equatorial speed sets its velocity scale. The projected 120-arcsec E–W radius stays fixed. The default spherical inner-shell hypothesis has 12.5 km/s expansion; its orientation is unidentifiable until the shape departs from a sphere. Defaults, publication interpretations and measured centroids are labeled separately.

Every plotted observation remains at its calibrated velocity relative to the published systemic value of −27.1±2 km/s. Sliders change the predicted curves, never the measured numbers. The nearest-surface RMS is descriptive; it is not a likelihood or a weighted statistical fit. The model supplies ideal centroid loci, not broadened synthetic spectra or hydrodynamics. Slit width, sampling and instrumental resolution are recorded but not claimed to be simulated. Faster observed components remain visibly unexplained.

The later 2008 correction to 2005 figures 3–5 does not identify this figure 9 core slit. Do not apply that correction indiscriminately. Future spectra must retain their actual reference frame and line identity.

## Evidence and next step

The combined browser check exercises three-source controls, on-map attribution, display-only switching, completed-job refresh reuse, and velocity controls/persistence without changing observations. Focused core tests cover angular registration, missing coverage, single-source retention, same-channel agreement, ridge direction, shell geometry and velocity-frame conversion. Compiled-copy mutations verify that removing key constraints fails their tests. Browser evidence stays under `.local/nebula-lab/multimodal-browser/`; scientific limitations above remain despite passing implementation checks.

Validation on 2026-09-12 covers `joint-evidence@1` and slit-recipe SHA-256 `65966387493596b8b9f245538b5310c7cb8f31fb675858bb98d89f4c19bc8f38`: all 252 lab tests passed, including the real three-source grid. Strict source/changed-test TypeScript and the lab build passed. The final browser pass includes resetting a hypothesis during a pending response; that case failed before the status-state fix. Retain these limits when reusing the result for later versions; this is implementation evidence, not validation of the inferred geometry.

Read [multimodal-research.md](multimodal-research.md) for primary papers and verified dataset leads. Prioritize a ridge graph, then compare alternative shell/lobe models with held-out image/slit evidence. The verified ALMA C1 cube and broad-field LVM spectra serve different follow-ups; neither is silently incorporated into this first slit model.
