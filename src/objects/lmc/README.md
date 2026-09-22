# Large Magellanic Cloud (LMC)

Three published images colour one shared three-dimensional emission model; **Horálek optical is the default**. Each lens carries the same 242 directional slices (97 x, 80 y, 65 z), packed into three WebP axis atlases, and the same 1,042 catalogue stars. All three lenses total 3,779,590 bytes of cloud textures in 9 files. Nothing here measures gas or dust depth.

The shape is a hypothesis with two parts. A broad envelope carries 80.75% of the Horálek image light along the depth distribution of the **Garver et al. stellar simulation**, and 470 fitted detail components sit at the strongest simulation mode along their own sightlines. The LMC has no observational depth tracer in this repository, so, unlike the SMC's ellipsoid, the envelope shape is the simulation's own and untested. Catalogue-star depths are realizations inside that model, not distances.

## Sources

| Source / lens | Role and selected input |
| --- | --- |
| [Garver, Nidever, Debattista & Deg simulation](https://doi.org/10.5061/dryad.1vhhmgr82) | Stellar-density prior: the envelope's depth distribution and the detail components' line-of-sight modes. |
| [Horálek optical, iotw2547a](https://noirlab.edu/public/images/iotw2547a/) | 6582 × 4388-pixel visible-light photograph; also the image the emission model was fitted to. Acquisition instrument and exact bands unspecified. |
| [ESO VISTA, eso1914a](https://www.eso.org/public/images/eso1914a/) | Y/J/Ks near-infrared display; 8954 × 10000 pixels. |
| [NASA/IPAC AllWISE through CDS](https://irsa.ipac.caltech.edu/onlinehelp/wise/wise/overview.html) | W4/W2/W1 false-colour HiPS mosaic; 6000² pixels across 24°, not native detector sampling. |
| [Bonanos et al. (2009)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003) | Observed sky positions and Johnson V for 1,042 selected massive stars; their depths are model-contained realizations. |
| [SMASH, noirlab2030a](https://noirlab.edu/public/images/noirlab2030a/) | Shared sky-registration reference every image is matched to. |

Native photographs supply colour after registered star removal. Every lens recolours the same neutral alpha, so switching lenses changes colour and never geometry. The fit covers only the registered Horálek footprint (10.06 × 6.74°), which is narrower in declination than the simulation's light.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; "included" means used by this delivery, not scientifically validated, and the search was not exhaustive.

## Processing

1. **Registration.** Each image keeps its measured sky solution from the pinned [alignment report](source/evidence/lmc/candidates/source/alignment-report.json). The model is placed with the identity placement, which reproduces the registered Horálek corners to 0.000″; the earlier hand-authored display placement had put the model on the sky 3.0009× too large.
2. **Emission.** The registered, star-removed Horálek image is smoothed (σ = 10 fit pixels) and divided by the integrated simulation column to give an envelope gain, so image brightness scales the envelope but never moves it in depth. The remaining detail is fitted with 470 positive finite components. [`emission-envelope.json`](source/evidence/lmc/envelope/emission-envelope.json) is the recipe; [EMISSION-METHOD.md](../../../labs/nebula/models/lmc/envelope/EMISSION-METHOD.md) explains the method and its rounds, and the [SMC method note](../../../labs/nebula/models/smc/constrained/EMISSION-METHOD.md) owns the derivation. The shared opacity uses exposure 2.418 and an alpha chroma limit of 11, both solved against the Horálek image.
3. **Lenses.** [`finite-lenses.json`](source/evidence/lmc/envelope/finite-lenses.json) bakes each registered image onto that one geometry with a per-channel tone curve fitted from paired pixels against that lens's own image. The curve's channel ratios act as white balance inside the alpha chroma limit and its common factor after it. The promotion installs the three lenses with identity appearance controls ([receipt](source/lens-settings-evidence.json)).
4. **Delivery.** The [compact inputs](source/compact/inputs.json) carry exactly what a replay needs: the fitted field, the envelope gain map, the neutral alpha bank, the depth density, the model's front projection that the tone curves read and, per lens, the registered colour raster, an alpha-only coverage mask and its tone curve. Each delivered byte's laboratory record is numbered under [`bake-inputs/references/`](source/bake-inputs/references).
5. **Stars.** Table 3 rows with finite V ≤ 16 whose measured ray lands on a covered footprint pixel; each depth inverts the joint emission × simulation density × (1+z/D)² CDF at a fixed per-star quantile. 1,042 are placed; 39 rows that fall outside the true Horálek footprint are not. [Star preparation](../../../labs/nebula/models/lmc/stars/README.md) records the selection.

## Evidence

- **Fit.** Total front-projection relative squared error 0.013060; projection RMSE 0.03247 after fitting against 0.10458 before. The envelope carries 80.75% of the image light with 3.29% excess. All 470 components found prior support. All 331 neutral textures reproduce the fitted neutral alpha exactly, with no recoloured texel outside the image or black.
- **Registration.** Field ratio 1.0000× and centre offset 0.000° against the star-matched homography. Of the 40 brightest catalogue stars projected onto the registered Horálek image, 17 fall within 1 px of a photographic peak (median 1.19 px, 22.9″); mirroring gives 1 of 40. Half of that residual is already in the publisher frame: the same stars sit a median 11.5″ from the native original through the registration chain alone. Measured on model `9dfd48a6…`, whose emission field and envelope are byte-identical to the shipped `a9e2048a…`; only the exposure changed.
- **Lenses against their own images.** Analytic render flux against each lens's own footprint-masked, sky-subtracted image after the tone fit: Horálek +1.8% (hue error 3.76°), VISTA +16.6% (5.70°), AllWISE +264% (8.14°). These are lab measurements of the analytic projection, which reads about 12% brighter than what the browser delivers.
- **App inspection.** [The promotion inspection](evidence/promotion-2026-09-19/inspection.json) and its captures hold the Earth view, an oblique view, both exact 90° side views, all three lens switches and stars on and off, taken from the running application by the shared browser conformance harness. Each lens decodes one texture at the Earth framing, a lens switch leaves the world camera unchanged, all 1,042 stars mount, render visible and toggle off, and the route raises no page error and no failing request. The side views show line-of-sight extent rather than a flat sheet. It ran at `18718b8e` on the bank restored from R2.
- **Delivery and replay.** `prepared/` is generated, not committed: `pnpm prepare:nebulae --if-missing` rebuilds the bank and its atlases from [the compact inputs](source/compact/inputs.json) alone, and the [object descriptor](object.json) pins the result. Verified with the ignored laboratory caches moved aside, from a removed `prepared/`: **all 726 regenerated slice textures are byte-identical** to the promotion output, the bank, its 9 atlases and the delivery receipt are byte-identical to the first restore, and the descriptor pin matches. The lab-isolated application gate reproduces the same bank and atlases. The 13 files of the [prepared inventory](inventory.json) are published to R2; `pnpm setup:prepared --object=lmc` into an emptied `prepared/` downloaded all 13 with the inventoried bytes and digests, and startup verification accepted them. [`lmc-volume-lenses.test.mts`](../../../site/test/lmc-volume-lenses.test.mts) checks the slice identity on every run; replaying without the tone curves turns it red.

## Known problems

- **VISTA and AllWISE are brighter than their own images:** +17% and +264% after fitting. Every lens shares the one opacity fitted to Horálek, so a tone curve can only dim or recolour inside it; matching them needs a per-lens opacity scale, which would give up part of "switch lens, never shape". AllWISE's own composite spans about 19 grey levels inside its footprint, so it has little tone to match.
- The envelope is the simulation's shape hypothesis and the detail components are conditioned on the same simulation; neither is measured gas geometry. The model records `materialGatePassed: false`. The LMC has no depth tracer here to test it, as VMC red clumps tested the SMC's shape.
- The fit is cut along the Horálek image's own bottom edge, and its default black point (the footprint's lower luma quartile) still clips the faint outer halo. After the tone fit the Horálek core-disc ratio is 1.00/0.94/0.93 in R/G/B, and the brightest 0.1% of pixels reach only 0.89–0.96 of the image, the shared opacity's ceiling.
- A violet-blue patch can remain on the western footprint edge where the envelope's chromaticity is extrapolated from few covered pixels, and a small detached knot group appears above the body at oblique and side poses.
- Faint concentric ripples remain where alpha is still quantized. Detail is bounded by the 384-pixel fit and 128 slabs on the longest axis.
- Star removal leaves crowded and saturated stars and can remove compact nebular light.
- The three per-lens `catalogue-stars.json` records the promotion writes are byte-identical copies of one star layer; the replay inputs reference a single copy.

<details>
<summary>Retired density-repaint delivery</summary>

Until this promotion the LMC shipped `alignment-density-material-v1`: one fixed simulated density with 144 slices per lens, repainted with each registered image and constrained from the Earth-facing view only. Its default was VISTA, it carried 943 stars, and its authored display placement put the model 3× too large on the sky. Its 432 slice textures, 9 atlases, compact bake inputs and atlas mapping are removed, and the laboratory bake recipe no longer delivers to the application. Its source record, recipe and retained evidence stay as documents, and its [README at the last delivering revision](https://github.com/layoutit/css.earth/blob/ad7bad50b4c875e4b709f9e496f11c29a5ba5b1a/src/objects/lmc/README.md) keeps its sources, evidence and known problems, including the XYZ-bank handoff banding this model removes.

</details>

Application provenance reads the object-owned evidence and recipe copies recorded in [provenance references](source/provenance-references.json). Their original revisions and SHA-256 pins are preserved; nested research paths describe historical inputs and are not application file reads.
