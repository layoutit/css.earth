# Large Magellanic Cloud (LMC)

Three lenses color the same simulated stellar-density cloud; **ESO VISTA is the default**. Each has 144 directional slices and the same 943 catalogue stars. This is not measured gas or dust depth.

## Sources

| Source / lens | Role and selected image |
| --- | --- |
| [Garver, Nidever, Debattista & Deg simulation](https://doi.org/10.5061/dryad.1vhhmgr82) | Stellar-density prior for the shared volume. |
| [ESO VISTA, eso1914a](https://www.eso.org/public/images/eso1914a/) | Y/J/Ks near-IR display; 8954 × 10000 pixels. |
| [Horálek optical, iotw2547a](https://noirlab.edu/public/images/iotw2547a/) | 6582 × 4388-pixel visible-light photograph; acquisition instrument and exact bands unspecified. |
| [NASA/IPAC AllWISE through CDS](https://irsa.ipac.caltech.edu/onlinehelp/wise/wise/overview.html) | W4/W2/W1 false-color HiPS mosaic; 6000² pixels across 24°, not native detector sampling. |
| [Bonanos et al. (2009)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003) | Observed sky positions and Johnson V photometry; 943 selected stars have deterministic, density-conditioned depths. Individual stellar distances are unmeasured. |
| [SMASH, noirlab2030a](https://noirlab.edu/public/images/noirlab2030a/) | Shared sky-registration and catalogue-selection reference; its former color lens is superseded. |

Native photographs supply color after registered star removal. They preserve the density slices’ geometry and alpha; uncovered regions retain neutral material. None covers the entire simulation. Measured image registration does not establish a correspondence between observed stars and simulated particles.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; “included” means used by this delivery, not scientifically validated.

## Evidence

- [Saved lens settings](source/lenses.json) and [handoff evidence](source/lens-settings-evidence.json) preserve the 2026-09-09 browser selection; per-lens results and provenance are linked there. [Delivery byte pins](source/lens-manifest.json) define the reproducibility target, not a newly completed cold replay.
- The [fixed alignment report](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/lmc/candidates/source/alignment-report.json) records 5340 VISTA and 198 Horálek held-out stars. WISE’s unchanged WCS was checked against 34,811 AllWISE matches; this checks W1 positions, not diffuse colors or seams.
- [Historical app handoff](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/NEXTSTEPS.md) records unchanged geometry/catalogue state across lenses. Its old passes remain tied to that version; this documentation review does not reaccept the material.

## Known problems

- XYZ-bank handoff brightness/banding and finite-resolution detail remain unresolved; historical six-view handoff failures are preserved.
- NOX and classical removal leave crowded/saturated stars and can remove compact nebular light. Exact recombination is not scientific star-removal validation.
- WISE seams, extrapolation beyond matched image hulls and neutral uncovered areas remain. Stellar depths are a conditional display realization, not parallax distances or proof of association with an emitting feature.

<details>
<summary>Methods and historical comparisons</summary>

[Slice stability](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/docs/slice-stability.md) explains the current density repainting and rejected wrong-cloud/registration routes. [Research history](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/docs/research/README.md) retains SMASH, starlet/getsf, filled-depth and smooth-density comparisons. [Native separation trials](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/lmc/star-separation/README.md) distinguish exact accounting from visual quality; [catalogue preparation](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/lmc/stars/README.md) records selection and conditional depths.

Saved VISTA brightness/gamma/saturation/detail/scale are 0.85/0.9/1.3/1/24; Horálek 1.3/1.3/2.5/1.95/96; WISE 1/1/1/0/24. These are authored appearance controls already in prepared pixels. Use the [shared baking guide](../../../labs/nebula/docs/baking.md) for restoration; no fresh cold-cache comparison is claimed here.

</details>
