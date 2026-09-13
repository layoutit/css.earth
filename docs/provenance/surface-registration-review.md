# All-object surface-registration review

**Review date:** 2026-09-11
**Reviewed revision:** `310fb173f62381afbeab3ec4855bf04b55f3c505`
**Purpose:** one faithfulness PR covering every registered object without changing the renderer, retained-DOM contract, geometry topology, shell, or navigation.

This is a catalog review, not a claim that every body has a photograph. The audit starts at every package and then separates source maps, source-camera observations, scientific fields, inferred/model surfaces, and packages with no surface input. A surface is eligible for a photographic lens only when the producer supplied a body-fixed map or a measured camera/body-shape relationship. A limb or terminator fit, a generic sphere, a visual match, or an approximate attitude is pointing evidence; it is not image-to-shape registration.

## Inventory

| Package set | Count | Review meaning |
| --- | ---: | --- |
| Object directories under `src/planets` | 477 | 473 registered packages plus the four README-only stubs. |
| Registered object packages with `object.json` and `source/manifest.json` | 473 | Every one was included in the inventory. |
| Packages with a non-model surface, observation, map, radar, spectral, geology, or photography input | 73 | Each appears in the disposition matrix below. The set deliberately includes scientific and model-derived inputs so they cannot be mistaken for photographs. |
| Model/elevation/shape-only packages | 400 | No photographic registration decision is needed; their README must continue to describe the material as shape, elevation, or an inferred model. The complete list is below. |
| README-only stubs with no registered scene | 4 | Deferred and explicitly unrendered: Cupid, Hippocamp, Mab, and Perdita. |

The 73-object audit set is:

`amalthea ariel arrokoth atlas bennu callisto calypso ceres charon comet-103p comet-19p comet-1p comet-67p comet-81p comet-8p comet-9p daphnis deimos didymos dimorphos dione donaldjohanson earth enceladus epimetheus eros europa gaspra ganymede helene hyperion iapetus ida io itokawa janus jupiter larissa lutetia mars mathilde mercury methone metis mimas miranda moon neptune oberon pallene pan pandora phobos phoebe pluto polydeuces prometheus proteus puck rhea ryugu saturn steins telesto tethys thebe titan titania triton umbriel uranus venus vesta`

README references to an image used only to infer a shape do not make that
package surface-bearing. Those observations remain in the 400-package
shape/model group unless a non-model raster, field, or camera product is part
of the package's inputs.

## Disposition matrix

### Controlled source registration — keep the existing lens

These packages have a source-controlled body map, a released camera/body-frame relationship, or both. Coverage limits, source shadows, photometric limits, and inferred unseen terrain remain part of each body README; they do not justify inventing pixels for the missing area.

`ariel atlas bennu callisto calypso ceres charon comet-19p daphnis donaldjohanson epimetheus eros europa gaspra ganymede helene hyperion iapetus ida io itokawa janus jupiter lutetia mars mercury moon miranda oberon pan pandora pluto prometheus phoebe ryugu saturn telesto titan titania triton umbriel uranus venus vesta earth neptune`

The controlled-camera subset is `atlas calypso daphnis donaldjohanson epimetheus gaspra helene hyperion ida itokawa janus lutetia pan pandora prometheus telesto`. The Saturnian small-moon camera packages use the released PDS shape camera tables; they are source geometry, not a by-eye texture fit. Donaldjohanson and Itokawa retain measured control points and disjoint holdouts. Ceres is controlled for the normal Dawn FC2 mosaic; its PIA19977 false-color interpretation remains a separate map product. `comet-19p` uses the released MICAS orthophoto/XYZ relationship.

### Source material kept, shape transfer or absolute registration still pending

These bodies have useful source maps or fields and must remain visible, but their current shape/map histories do not yet prove the strict transfer needed for a fully faithful photographic lens. Keep the maps and their gaps; repair the transfer in a later focused record rather than deleting the body or replacing it with an unmarked projection.

| Object | Current boundary |
| --- | --- |
| Deimos | Stooke Viking/MRO map has no supplied validity mask; shape extremities and geographic transfer remain open. |
| Dione | Cassini/Voyager map and VIMS are source products, but geographic registration, silhouette, and feature review remain pending. |
| Enceladus | Schenk map is controlled as a source map; the corrected-v2 shape alignment and browser feature qualification remain open. |
| Mathilde | Stooke/Pfau map has positional control and axes, but no global measured terrain fit to the current shape. |
| Mimas | Published maps have separate cartographic frames from the candidate shape; no new feature-to-shape transfer is claimed. |
| Phobos | DLR-controlled mosaic and SPC fields use different source histories; complete transfer qualification remains open. |
| Rhea | Photographic maps are retained, but absolute VIMS registration and shape transfer remain unresolved. |
| Tethys | Source maps are retained; no resolved Odysseus-centre or absolute VIMS registration is claimed. |

### Insufficient image-to-shape control — defer only the photographic lens

The body, measured or inferred shape, and any honest model/elevation lens stay in the catalog. The photographic observation is not promoted until an independently controlled surface correspondence exists.

| Object/lens | Evidence and action |
| --- | --- |
| Amalthea | Existing camera fit is explicitly approximate and not a new photogrammetric solution; keep it as coarse/pointing evidence. |
| 1P/Halley · Giotto | Four-percent projected footprint and held-out silhouette check constrain an approximate encounter projection, not feature registration to the later shape; defer the photographic Giotto lens and retain the historical/model lens with the approximation labeled. |
| Larissa | Limb-only camera fit is not modern photogrammetric control; do not call its texture registered. |
| Methone | Ellipsoid limb/terminator fit has no independent surface landmark control. |
| Metis | Coarse ellipsoid limits registration; no surface landmarks establish the camera transform. |
| Pallene | The pinned calibrated source is only 8 × 13 illuminated pixels at the accepted thresholds and contains no independently identifiable surface feature. The direct check is recorded in [`registration-attempt-2026-09-10.json`](../../src/planets/pallene/source/survey/registration-attempt-2026-09-10.json). |
| Polydeuces | The selected frame is only about 9 × 7 pixels; measured-axis/limb evidence cannot locate surface detail. |
| Proteus | GEOMED outline and inter-band checks establish coarse pointing, not independent cartographic feature control. |
| Puck | Sphere/limb fit is an approximation with no surface landmarks. |
| Steins · OSIRIS | The source camera has no surface-intercept anchor or fitted image-to-shape registration. The separate Stooke map remains source material. |
| Thebe | A two-dimensional center translation to the illuminated outline is not a controlled image-to-shape solution. |

### Scientific or model-derived surfaces — keep, label the quantity

These inputs are valuable, but they are not direct photographic albedo maps. The UI and README should name the measured quantity or model: radar backscatter, thermal or spectral field, geology, relative albedo, fitted albedo, constraint class, or inferred shape. No color stretch turns one into a photograph.

`arrokoth comet-103p comet-67p comet-8p comet-81p comet-9p didymos dimorphos`

`comet-67p` also contains calibrated OSIRIS photographs; its VIRTIS fields have a documented local registration uncertainty near the neck, so that boundary stays visible in the package documentation. `arrokoth` exposes Porter’s fitted albedo model over the imaged southern hemisphere, with the modeled/unseen northern surface explicitly marked. `comet-103p`, `comet-81p`, and `comet-9p` use source constraint classifications or neutral modeled shape rather than an observed albedo surface. `comet-8p` is a radar/inferred-shape comparison. `didymos` and `dimorphos` expose facet relative-albedo fields, not photographs.

## Comet surface-place review — 2026-09-12

**Review base:** `53b262bd`. This section reviews all 32 current comet
`object.json` packages once, for source-backed clickable surface places. It
does not change the renderer, scene topology, or camera. It also does
not treat a future preparation result as browser evidence.

The follow-up, integrated with main at `e986b9280`, qualifies image registration for Wild 2 and
Borrelly. The current source-qualified total is **41 places**: 28 on 67P,
one on Tempel 1, three on Hartley 2, two inferred-anatomy points on Tuttle,
three named depressions on Wild 2 and four mapped terrains on Borrelly. “Accepted” in
this table means source-qualified; it does not say a new interaction has
passed browser validation.

Here, **observed** means a place is tied to a published body-frame map or
image-panel coordinate. **Inferred anatomy** means a published shape model
supports a lobe or contact location but not terrain. An **unregistered
candidate** has useful imagery or shape evidence but lacks a demonstrated
surface place in the displayed frame.

| Comet package | Source actually examined | Place disposition |
| --- | --- | --- |
| `comet-103p` | [PDS Hartley 2 shape](https://pdssbn.astro.umd.edu/holdings/dif-c-hriv_mri-5-hartley2-shape-v1.0/dataset.shtml); [Thomas et al. 2013, Figs. 3 and 7](https://ntrs.nasa.gov/api/citations/20140009994/downloads/20140009994.pdf) | **3 mapped-terrain regions:** waist 30E/55N and large-lobe patch 31E/53S are published panel centres; elongate smooth area 350E/50S is a representative map point. The ±3° and ±12° placement estimates are ours. |
| `comet-109p` | [package source record](../../src/planets/comet-109p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: shared illustrative mesh and fixed illustrative attitude have no body frame or terrain. |
| `comet-137p` | [package source record](../../src/planets/comet-137p/source/reference/source-record.json); [Donaldson 2025 thesis](https://era.ed.ac.uk/items/cf7f5ebf-4f32-4f86-95d2-b8dd2e37c8ad) | No anchor: convex inversion gives shape and pole, not a public mesh, longitude origin, or mapped terrain. |
| `comet-143p` | [package source record](../../src/planets/comet-143p/source/reference/source-record.json); [Donaldson 2025 thesis](https://era.ed.ac.uk/items/cf7f5ebf-4f32-4f86-95d2-b8dd2e37c8ad) | No anchor: the convex model has no registered longitude or surface-feature coordinates. |
| `comet-153p` | [package source record](../../src/planets/comet-153p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: illustrative shared mesh, with no measured attitude or terrain. |
| `comet-162p` | [package source record](../../src/planets/comet-162p/source/reference/source-record.json); [Donaldson 2025 thesis](https://era.ed.ac.uk/items/cf7f5ebf-4f32-4f86-95d2-b8dd2e37c8ad) | No anchor: tentative bilobate anatomy from planar convex-model facets is not mapped geography. |
| `comet-167p` | [package source record](../../src/planets/comet-167p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: catalog size and illustrative mesh supply no measured surface frame. |
| `comet-17p` | [package source record](../../src/planets/comet-17p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: the outburst is coma history; the nucleus is illustrative and unregistered. |
| `comet-19p` | [Britt et al. 2004, Figs. 1 and 4](https://doi.org/10.1016/j.icarus.2003.09.004); original MICAS orthophoto/XYZ cubes; [package README](../../src/planets/comet-19p/README.md) | **4 mapped-terrain places:** upper/lower mottled terrain, central mesas and central smooth terrain. Two image registrations use independent withheld controls before native XYZ lookup. Approximate interiors, MICAS view only; lower smooth terrain remains withheld near the image edge. |
| `comet-1p` | [package Giotto registration record](../../src/planets/comet-1p/source/reference/giotto-registration.json); [Halley PDS search](https://sbnapps.psi.edu/ferret/SimpleSearch/results.action?targetName=1P%2FHalley+1) | No terrain anchor: current Giotto and Vega directions are observation areas, not registered feature intercepts in the selected frame. |
| `comet-209p` | [package source record](../../src/planets/comet-209p/source/reference/source-record.json); [Schleicher & Knight 2016](https://arxiv.org/pdf/1605.01705) | No anchor: radar supplies overall dimensions only; the ellipsoid orientation is illustrative. |
| `comet-21p` | [package source record](../../src/planets/comet-21p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: the ICE tail encounter did not map the nucleus; mesh and attitude are illustrative. |
| `comet-26p` | [package source record](../../src/planets/comet-26p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: Giotto encounter context does not provide a nucleus surface frame. |
| `comet-29p` | [package source record](../../src/planets/comet-29p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: coma jets do not map to the illustrative nucleus. |
| `comet-2p` | [package source record](../../src/planets/comet-2p/source/reference/source-record.json); [Harmon & Nolan 2005](https://doi.org/10.1016/j.icarus.2005.01.012) | No anchor: radar-constrained ellipsoid axes have an illustrative attitude and no terrain coordinate system. |
| `comet-46p` | [package source record](../../src/planets/comet-46p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: mission history does not resolve terrain on the illustrative nucleus. |
| `comet-55p` | [package source record](../../src/planets/comet-55p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: meteor-stream context supplies no nucleus surface frame. |
| `comet-67p` | [SHAP7 regions](https://doi.org/10.17632/2845znt54k.1); [package landmarks](../../src/planets/comet-67p/source/features/landmarks.json) | **28 accepted:** 26 SHAP7 regions plus the two existing Philae sites; registered to the package’s mapped shape sources. |
| `comet-81p` | [NASA PIA06285](https://science.nasa.gov/photojournal/wild-2-close-look/); [Brownlee et al. 2004, Fig. 2](https://doi.org/10.1126/science.1097899); native N2073 FITS and full PDS shape; [package README](../../src/planets/comet-81p/README.md) | **3 named depressions:** Mayo, Left Foot and Right Foot. Interior photo matches establish correspondence with N2073; camera rays intersect observed source faces. Approximate locations; Hemenway/Rahe remain too sensitive, and Shoemaker/Walker callouts project to estimated terrain. |
| `comet-8p` | [package model record](../../src/planets/comet-8p/source/shape/model.json); [Groussin et al. (2019)](https://arxiv.org/abs/1911.04897) | **2 inferred-anatomy points:** large and small lobes in the default model; neither is observed terrain. Browser inspection rejected the contact label because the nearer lobe hides it after the camera approaches. |
| `comet-96p` | [package source record](../../src/planets/comet-96p/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: solar-observatory context does not register the illustrative nucleus. |
| `comet-9p` | [Tempel 1 PDS shape](https://pdssbn.astro.umd.edu/holdings/dif-c-hriv_its_mri-5-tempel1-shape-v2.0/dataset.shtml); [package photography note](../../src/planets/comet-9p/source/reference/encounter-photography.md) | **1 qualified site:** Deep Impact, approximately 16° E, 28° S in the PDS 2012 frame. Photograph registration is a separate qualification. |
| `comet-c1956-r1` | [package source record](../../src/planets/comet-c1956-r1/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: historical appearance does not locate terrain on the illustrative mesh. |
| `comet-c1973-e1` | [package source record](../../src/planets/comet-c1973-e1/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: historical appearance does not locate terrain on the illustrative mesh. |
| `comet-c1983-h1` | [package source record](../../src/planets/comet-c1983-h1/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: discovery history does not locate terrain on the illustrative mesh. |
| `comet-c1995-o1` | [package source record](../../src/planets/comet-c1995-o1/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: shared procedural mesh and fixed attitude have no terrain correspondence. |
| `comet-c1996-b2` | [package source record](../../src/planets/comet-c1996-b2/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: shared procedural mesh and fixed attitude have no terrain correspondence. |
| `comet-c2006-p1` | [package source record](../../src/planets/comet-c2006-p1/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: shared procedural mesh and fixed attitude have no terrain correspondence. |
| `comet-c2013-a1` | [package source record](../../src/planets/comet-c2013-a1/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: shared procedural mesh and fixed attitude have no terrain correspondence. |
| `comet-c2014-un271` | [package source record](../../src/planets/comet-c2014-un271/source/reference/source-record.json); [ALMA coma study](https://ntrs.nasa.gov/api/citations/20250006397/downloads/UN271_ALMA_ApJL_aasv7_Accepted.pdf) | No anchor: the study concerns coma gas and the displayed rough sphere is illustrative. |
| `comet-c2020-f3` | [package source record](../../src/planets/comet-c2020-f3/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: shared procedural mesh and fixed attitude have no terrain correspondence. |
| `comet-c2023-a3` | [package source record](../../src/planets/comet-c2023-a3/source/reference/source-record.json); pinned [Celestia catalog](https://github.com/CelestiaProject/CelestiaContent/blob/1993a082ee6307c0df7fdc0828eb117a0e8e9958/data/comets.ssc) | No anchor: shared procedural mesh and fixed attitude have no terrain correspondence. |

## Packages with no non-model surface input

The following 400 packages are shape, elevation, constraint, or inferred-body scenes. They were reviewed for honest labeling and do not need an image-to-shape registration change in this PR.

**Asteroids (298):**

`abundantia achilles adelheid aegina aemilia aethra agenor aglaja ajax alexandra alkeste alkmene alphonsina althaea ambrosia amphitrite anahita angelina anna annefrank antigone antonia apophis arethusa ariadne artemis aschera asia asporina asteroid-1950-da asteroid-1992-sk asteroid-1994-cc asteroid-1996-hw1 asteroid-1998-ml14 asteroid-1998-wt24 asteroid-1999-fr33 asteroid-2001-qw16 asteroid-2001-sn263 asteroid-2002-ce26 asteroid-2008-ev5 asterope astraea atalante athamantis athor augusta auravictrix aurora ausonia bacchus badenia bamberga baucis bavaria beatrix bellona bertha bettina betulia bienor braille brucia brunhild byblis camilla castalia cerberus chariklo china circe clarissa clementina coelestina crimea cybele cyrene daphne davida dejanira dejopeja demodokus desdemona-666 dido dike dinkinesh diomedes dione-106 diotima doris dresda ducrosa echo educatio egeria elektra eleonora elpis emma eos erato erigone eudora eugenia eukrate eumelos eunomia euphrosyne europa-52 eurybates eurykleia eurynome euterpe eva felicitas feronia fides flora fortuna freia galatea-74 gallia ganymed geographos gerda golevka gryphia gyptis harmonia hebe hedda hekate hektor hela henrietta hera herculina hermione hersilia hertha hesperia hestia hidalgo hopi huberta hygiea hypatia ianthe iau iclea ilioneus ilse ino interamnia io-85 iphigenia irene iris isabella isis ivar johanna juewa julia juno kalliope kallisto kalypso kemi kleopatra klio klotho klymene klytia kolga kressmannia kriemhild lachesis laetitia lamberta laurentia leda-38 leto leucus leukothea liberatrix libussa lilaea lomia loreley lucia lucina lycomedes lydia lyyli maja massalia medea medusa melete meliboea melpomene menelaus menippe mentor metis-9 minerva mithra moshup moskva mr-spock musa nausikaa nemausa nemesis nereus niobe nuwa nysa oenone orus pales pallas palma pandora-55 panopaea parthenope parysatis patroclus peitho penelope penthesilea petrina phaedra phaethon philagoria philosophia phocaea piazzia polyhymnia polymele pomona proserpina protogeneia psyche pyrrhus ra-shalom raup reinmuthia rhodope rosalinde rusthawelia sapientia sappho schaber schorria scylla selinur semele sibylla silesia silvretta siwa sophrosyne stephania susi sylvia tantalus tartaglia taurinensis thalia themis thetis thisbe thule thyra toro toutatis transvaalia tulipa tyche una unitas united-nations urania urda vanadis velleda vera veritas vibilia victoria vindobona virginia virtanen weringia xanthippe yorp zachia`

**Comets (26):**

`comet-109p comet-137p comet-143p comet-153p comet-162p comet-167p comet-17p comet-209p comet-21p comet-26p comet-29p comet-2p comet-46p comet-55p comet-96p comet-c1956-r1 comet-c1973-e1 comet-c1983-h1 comet-c1995-o1 comet-c1996-b2 comet-c2006-p1 comet-c2013-a1 comet-c2014-un271 comet-c2020-f3 comet-c2023-a3`

**Dwarf planets (3):** `eris haumea makemake`
**Interstellar (1):** `oumuamua`
**Satellites (56):**

`adrastea aegaeon albiorix anthe bebhionn belinda bergelmir bestla bianca caliban cordelia cressida dactyl desdemona despina erriapus fornjot galatea greip hati hiiaka himalia hydra hyrrokkin ijiraq juliet kerberos kiviuq loge menoetius mundilfari naiad nereid nix ophelia paaliaq portia prospero romulus rosalind selam setebos siarnaq skathi skoll sn263-beta sn263-gamma squannit styx suttungr sycorax tarqeq tarvos thalassa thrymr ymir`

**Star (1):** `sun`

## README-only stubs

`cupid`, `hippocamp`, `mab`, and `perdita` have no `object.json` scene. Their READMEs correctly describe unresolved detections or photometric size estimates and do not promise a shape, map, or photographic lens. They remain deferred until a source-backed shape and a supported scene package exist.

## PR acceptance

This review is complete when the faithfulness PR:

1. keeps the shared renderer and one-object scene contract unchanged;
2. preserves all 473 registered packages and the four explicit stubs;
3. leaves controlled maps/cameras in place with their source gaps visible;
4. records pending transfer work instead of silently draping a map onto a different shape;
5. defers only the eleven unsupported photographic lenses above, while retaining each body's honest model/elevation view; and
6. keeps scientific and fitted products labeled by what they measure.

The reusable rule is maintained in [the celestial skill](../../.agents/skills/celestial-skill/SKILL.md) and the detailed camera checks are in [registered-photographic-mosaics.md](../../.agents/skills/celestial-skill/references/registered-photographic-mosaics.md).
