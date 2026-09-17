# Observation-constrained SMC shape trial

This combines the Garver simulation's three-dimensional stellar structure with the VMC red-clump observations. It is a neutral, conditional model comparison—not a dynamical rerun or an accepted gas/dust reconstruction. The simulation, raw catalogue and ellipsoid comparison remain separate lab choices.

## What is fitted

The pinned original simulation particles are recentered about their coordinate-wise median, then transformed with positive axis scales, three rotations and a translation. All original particles remain in the baked model; none are clipped to the photograph. The competing ellipsoid uses a deterministic Gaussian sample and the same affine family and fitting procedure.

Each candidate is projected into sky position and distance-modulus bins, broadened by a magnitude-error kernel, then passed through the survey-selection approximation. The latter uses the published RC catalogue's occupied sky cells and retained/published counts; outside this footprint there is no likelihood penalty pretending that the galaxy is empty. A fixed contaminant component prevents sparse brightness tails from determining all of the fitted shape.

The optimization uses only training regions. A fixed checkerboard of larger sky blocks is withheld; its Poisson deviance is reported separately. Multiple starts compete on training score only. A denser particle sample refines the selected start, and final scores are recomputed with every model particle. Nuisance widths of 0.03 and 0.10 mag test sensitivity around the 0.06-mag trial, each added in quadrature to the observed median Ks error. Those nuisance widths are authored assumptions, not measured total errors.

The fit is deliberately bounded: global orientation, three physical scales and centre, followed by eight smooth, overlapping regional weights on the simulation alone. These multiply source-particle weights within 0.5–2 at fixed geometry, with a log-weight penalty toward one. They are a tracer correction, not a dynamical evolution or recovered stellar mass. There is no per-pixel photographic warping. Published axis ratios are contextual evidence, not a target ratio forced onto this different stellar sample.

## Sources and limits

- [Garver et al. simulation](https://doi.org/10.5061/dryad.1vhhmgr82): all 225,000 imported SMC stellar particles at the previously pinned epoch. They lack red-clump population tags; relative simulation weights are only a tracer proxy.
- [Tatton et al. (2021)](https://doi.org/10.1093/mnras/staa3857): catalogue positions and reddening, paired with public ESO PSF photometry. The pinned [VMC intake](../vmc/README.md) records matching, duplicate removal and photometric-release differences.
- [Subramanian & Subramaniam (2012)](https://doi.org/10.1088/0004-637X/744/2/128): why sky coverage affects inferred axis ratios. Its optical-band uncertainty corrections are not transplanted into the VMC calculation.

The selection is an empirical approximation, not a full survey likelihood. Magnitude-dependent completeness, individual extinction covariance, population variations and contamination are not independently solved. Photometric distance estimates are not geometric stellar distances. Large-scale extensions outside observed coverage remain model-dependent. A good front projection or a visually rounder cloud cannot validate those extensions.

The current frozen VMC intake also omitted unmatched entries at the RA wrap; 476 published rows have negative RA. The fit footprint correctly normalizes these angles, and their missing matches are part of its retention mask. Revising that intake is a separate versioned source correction; this trial does not silently replace the existing catalogue pins.

## Replay and inspection

`fit.json` pins the inputs, parameter bounds, starts, seed, histogram, uncertainty assumptions and bounded search. The `fit-tracer-density` lab command produces comparison and model receipts plus bake recipes under `.local/nebula-lab/smc-constrained`. Each receipt includes the fitter and orchestration code hashes. Run each generated recipe with the `prepare-catalogue-density` lab command to restore the neutral volume through the shared baker. No new star-removal or photographic-material run is involved.

The lab routes are `/alignment?subject=smc-constrained` and `/alignment?subject=smc-ellipsoid`. Enable **Density overlay** to compare unchanged registered images, then turn **Show image** off and orbit to inspect the conditional structure. No application object is promoted by this experiment.

## Evidence and acceptance

See `fit-evidence.json` for the executed recipe, input/code pins, full-particle held-out scores and uncertainty sensitivity. Lower deviance is better within the stated approximation. A failed comparison remains a useful rejected hypothesis; it must not become a production model because it looks less tubular.

Tests cover physical transforms, observable-only uncertainty, sources scattering across measurement bounds, excluded versus empty sky cells, and held-out data not affecting the optimizer. Browser inspection covers actual front/oblique renders and dragging. These checks establish a functioning experiment, not physical truth.

### Executed comparison

Full-particle withheld deviance per observed count (lower is better):

| Model | Score |
| --- | ---: |
| Affine simulation | 0.60119 |
| Simulation with bounded regional weights | 0.59503 |
| Simple ellipsoid | 0.45749 |

Regional weighting improves the simulation slightly; it does not beat the simpler control. Keep both as neutral inspection candidates. The simulation's asymmetric extensions remain a prior, not a demonstrated observation. The simulation reaches the lower transverse-shape bound, another reason not to accept its shape yet.

The receipt distinguishes affine refits under alternative uncertainty widths from fixed-geometry, fixed-weight sensitivity evaluations. No withheld score selects a start, parameter or regional coefficient.

## Image-conditioned emission trial

The subsequent [finite-emission experiment](EMISSION-METHOD.md) uses this simulation only as a conditional depth prior and fits spatial emission structures from the registered optical image. It is separate from the neutral stellar-density fit above and from the rejected fixed-density colour-only bakes. Its inspection must establish visual direction before any application promotion.
