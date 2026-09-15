# Torifune — source assessment

Torifune (98943, formerly 2001 CC21) is a candidate for a new asteroid package.
This is research for a draft PR, checked on **15 September 2026**. It does not
register a scene or supply a prepared body.

## Sources

| Source | What it supports |
| --- | --- |
| [JAXA, 30 July 2026 briefing, slide 13](https://www.hayabusa2.jaxa.jp/en/enjoy/material/press/Hayabusa2_Press_20260730.pdf#page=13) | Post-flyby estimates: long dimension about **840 m**, short dimension about **340 m**, and average diameter about **540 m**. The slide marks the first two dimensions on the ONC-T image. It does not specify three principal axes or define the average diameter as volume-equivalent. |
| [JAXA, 6 July 2026 image release](https://global.jaxa.jp/press/2026/07/20260706-3_e.html) | Resolved optical and thermal images from the 5 July flyby. The optical image supplies a visual reference for the two-lobed outline and surface detail. |
| [Fatka et al. (2026), preprint v1](https://arxiv.org/html/2607.03276v1) and [published CDS release](https://cdsarc.cds.unistra.fr/ftp/J/other/Icar/459.K7229/ReadMe) | A pre-encounter convex light-curve model and spin solution. The nominal period is 5.0215221 h and the ecliptic pole is (314°, +84°). The model cannot represent the observed concavities. |

## Evidence

The July 30 measurement slide was downloaded, its text extracted, and the rendered
slide inspected. The 840 m and 340 m annotations were checked against that image.
The earlier [July 6 briefing](https://www.hayabusa2.jaxa.jp/en/enjoy/material/press/Hayabusa2_Press_20260706_rev_en.pdf#page=17)
still lists an approximately 450 m average diameter on its target summary slide;
use the later measurement with its stated meaning rather than silently combining
the two estimates.

The 2026 shape paper's methods, results and data-availability section were read.
Its preprint says the CDS identifier is pending, but a release now exists:
**J/other/Icar/459.K7229**. Its actual directory contains only `ReadMe` and
`lc.dat`; the latter supplies 157 photometric measurements from seven observing
sessions. The catalogue title mentions a shape model, but these files contain
no mesh. The CDS release declares CC BY 4.0; that does not establish terms or
availability for a separate model file.

The following additional routes were checked. These are bounded checks of the
named resources, not an exhaustive claim that no Torifune model exists.

| Route examined | Finding and next useful evidence |
| --- | --- |
| [DAMIT search for 98943](https://damit.cuni.cz/projects/damit/?q=98943) | Returned “No models found.” Recheck when a Torifune entry or a direct author release is available. |
| [Fatka et al. (2025) CDS release](https://cdsarc.cds.unistra.fr/ftp/J/A+A/695/A139/) | The directory and ReadMe list tables and light-curve subdirectories, with no shape mesh. Full publisher text could not be retrieved in this check. A numerical model or model-specific supplement remains unresolved. |
| [Popescu et al. (2025), section III.2](https://arxiv.org/html/2501.15644v1#S3.SS2) | Examined the light-curve inversion method, pole solutions and shape-figure description. The section cites DAMIT's inversion software; that is not a downloadable Torifune model. A separate release remains unresolved. |
| [JAXA DARTS Hayabusa2 archive](https://data.darts.isas.jaxa.jp/pub/hayabusa2/), including [shape](https://data.darts.isas.jaxa.jp/pub/hayabusa2/shape/), [paper](https://data.darts.isas.jaxa.jp/pub/hayabusa2/paper/) and [products](https://data.darts.isas.jaxa.jp/pub/hayabusa2/products/) indexes | No Torifune-specific numerical mesh or registered image bundle was identified in these directory listings. Instrument bundle contents and all SPICE products have not been exhaustively inspected. |
| [Celestia Torifune add-on](https://celestia.mobi/resources/item/FB78582B-13D6-F55E-4862-85EAD1D50E49) | The author explicitly identifies its shape as a generic contact-binary model pending actual mission data. Excluded as scientific geometry. No add-on assets were acquired. |
| [JAXA image-use terms](https://global.jaxa.jp/policy.html#2) | The site restricts modifications and distinguishes JAXA material from other or joint ownership. The image release credits multiple institutions. Photographic texture reuse is unresolved; publication on JAXA's site is not a blanket permission for texture derivatives. |

## Known problems

**A scientific mesh has not been retrieved.** The existing cssEarth asteroid
pipeline can render a suitable mesh, but published axis ratios, a paper figure,
or an archive search result cannot stand in for its vertices and faces.

**A photographic surface is not qualified.** The press images do not supply a
matched source mesh and controlled camera registration in the inspected release.
The remaining original-image, geometry and reuse questions must be resolved
before projecting photographs onto a body. The July 6 release also says that
observations stopped before closest approach; full surface coverage must not be
assumed from the flyby.

**An approximation requires explicit choices.** JAXA's dimensions and image
outline could constrain a modeled Shape view. They do not independently measure
lobe depths, principal axes, density, body-frame orientation or the neck. The
existing contact-ellipsoid preparer makes two touching smooth lobes; it is not a
reconstruction of the visible neck. Any such view would need its assumptions
visible beside the body and checks against the actual image constraints. No
approximation has been selected or implemented in this draft.

## Implementation boundary

Once the presentation is selected, use the existing generic object adapter,
shared camera and authored asteroid preparation. Keep source decisions in the
body's investigation ledger when its descriptor is added. Pin the selected
scientific inputs, add Torifune's own astronomy record, and verify the prepared
shape and browser interactions before treating the package as delivered.

The next decision is whether to prepare a clearly labeled image-constrained
approximation, or retain this research draft until a suitable published mesh
is obtained. Runtime, source-closure and browser tests have not been run because
this draft adds no executable package or scene.
