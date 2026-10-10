# Pleiades (M45)

Five image datasets share one authored reflection-nebula depth surface. **The default optical composite combines Taavi Niittee’s wide photograph with central NOIRLab detail.** Dust depth, illumination and scattering are not recovered. The catalogue explicitly identifies the Pleiades stellar cluster as the subject of the adopted distance; the nebula uses it for placement. The NOIRLab source carries its published image identity and B/V/I bands, with unknown exposure date and instrument left explicit in that record.

## Sources

| Source / dataset | Selected image and coverage |
| --- | --- |
| [Niittee wide optical](https://commons.wikimedia.org/wiki/File:Plejades.jpg) + [NOIRLab](https://noirlab.edu/public/images/noao-m45/) | Default composite: 8000 × 5199-pixel photograph, 264.79′ × 172.08′, observed 2024-01-04; central detail from the separate NOIRLab image. |
| [NOIRLab optical](https://noirlab.edu/public/images/noao-m45/) | B/V/I display, 4000 × 2920 pixels, 68.68′ × 50.13′; exposure dates unspecified. |
| [Spitzer IRAC](https://science.nasa.gov/photojournal/pink-pleiades/) | 3.6/4.5/5.8/8 µm false color; 2855² pixels, 58.07′ square. |
| [Spitzer IRAC + MIPS](https://science.nasa.gov/photojournal/the-seven-sisters-pose-for-spitzer/) | 4.5/8/24 µm false color; same 58.07′ field. |
| [WISE](https://science.nasa.gov/photojournal/seven-sisters-get-wise/) | 3.4/4.6/12/22 µm false color; 4007 × 3061 pixels, 182.99′ × 139.79′. |

Niittee’s processed color-camera image uses an L-Pro filter; its delivered pixel count exceeds the sensor grid and does not establish angular resolution. The infrared composites have distinct beams and nonlinear stretches. The cluster scale is **136.2 ± 1.2 pc** from [Melis et al. (2014), main text and Table 1](https://doi.org/10.1126/science.1256101), not a distance for every dust filament.

The [stellar field](source/stellar-field.json) contains 414 Gaia candidates within an authored 20 pc sphere, G < 12. After angular deduplication, 412 use Bailer-Jones distance estimates and eight named Hipparcos stars retain conditional model depths: 420 points shared by all datasets. Neither population establishes dust membership.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; “included” means used by this delivery, not scientifically validated.

**Far view.** From afar the bank is one image on a plane fixed in its frame, drawn as the Milky Way's backing is. [`prepare-galaxy-backing.mts`](../../../packages/bake/cli/prepare-galaxy-backing.mts) reads the [backing recipe](source/backing/recipe.json) and lays each dataset's own Sun-facing impostor view through the frame's centre, across the line of sight from Earth; no image is re-encoded. From Earth the plane shows the view the volume was drawn as, and the hand-over keeps its position, size and orientation. It replaced a camera-facing billboard of the same view, which turned with the camera. After a rebake of the bank, run `node packages/bake/cli/prepare-galaxy-backing.mts src/objects/m45-volume backing` again.

## Evidence

- Recorded app checks cover the delivered composite and catalogue field; report context limits their claims.
- [Delivery](source/delivery.json) pins the compiler and composite recipes. The app composite uses a freshly supplied compiler result; the historical standalone composite remains a separate comparison. This is not a new cold-replay or material acceptance claim.
- [Historical registration evidence](../../../src/objects/m45-volume/source/registration-evidence.json) records relative stellar alignment. Niittee’s 99 held-out stars give 0.450″ RMS only within the central NOIRLab overlap; absolute and outer-field distortion remain unqualified.

## Known problems

- From well off the Earth line of sight the far plane is foreshortened, and edge-on it vanishes, while the volume keeps its depth. The hand-over there is a cross-fade between two different shapes.
- Fine filaments soften, bright-star halos remain, and oblique views can form thin ribbons or show slice/color traces. Prior finite-material trials failed the visual gate.
- One warped surface cannot represent overlapping foreground/background dust layers. All thicknesses and offsets are authored; the published 0.7 pc scattering-layer hypothesis is not fitted geometry.
- Each image ends at its own footprint. Wider coverage and exact pixel accounting do not establish complete cloud coverage or calibrated photometry.

<details>
<summary>Methods and historical comparisons</summary>

The [fixed lab account](../../../src/objects/m45-volume/source/README.md) retains historical replay hashes, native separation checks and failed material views. [Physical evidence](../../../src/objects/m45-volume/source/physical-evidence.json) scopes the Gibson–Nordsieck and Ritchey interpretations. The [source dossier](../../../src/objects/m45-volume/source/source-dossier.json) preserves excluded 2MASS/IRIS and preliminary Usama/Andreo candidates, plus unacquired WISP UV data. General preparation is in the [nebula guide](../../../docs/nebulae/README.md).

</details>

## Compact delivery inputs

The source-owned compact input pin in [delivery.json](source/delivery.json) retains the accepted pre-slice model, material and integration data. Ordinary preparation regenerates the runtime WebP Q80/A80 XYZ atlases and distant impostors without native observation downloads, star extraction or model fitting. Runtime images remain generated and ignored. The [shared bake guide](../../../docs/nebulae/README.md#compact-inputs-and-research-replay) distinguishes this replay from optional full research processing. Source observations and the model limitations above still apply.

Application provenance reads the object-owned evidence and recipe copies recorded in [provenance references](source/provenance-references.json). Their original revisions are preserved; nested research paths describe historical inputs and are not application file reads.
