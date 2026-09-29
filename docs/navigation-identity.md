# Navigation identity and evidence

`OBJECTS` is the application inventory of navigable subjects. It combines
registered body packages with subjects from the prepared galaxy, cluster and
nebula catalogues. Search, aliases and classification tabs use this inventory.

| Concept | Meaning and owner |
| --- | --- |
| Scene destination | A body package with a route, prepared world frame and scene loader. |
| Prepared-focus destination | A catalogue subject the map can open: a galaxy cluster, or a subject an object package details. Its page, `/<id>/`, is its host scene’s page with the subject selected; `?dataset=` selects its lens, as on every page. Other catalogue rows are labels with no page. |
| Overview | The Milky Way, the Local Group and the Nearby Universe (`OVERVIEW_TITLES`). Its page, `/<id>/`, is the world host's scene page with the overview selected. |
| Rendering resource | A volume, image bank, point field or other prepared content. A resource descriptor alone does not publish a destination. |
| Dataset view | A selectable `(objectId, lensId)` presentation, which may combine several products and published sources. |
| Published source | A scientific work, release or product identified in the source catalogue; a local file hash identifies retained bytes separately. |

Every page is `/<id>/`, one URL system for all three kinds of page:
[`navigation-scope.mts`](../site/navigation/navigation-scope.mts) reads and
writes them. A scene's page mounts that scene. A catalogue subject or an overview
is drawn by a mounted scene: opened cold, its page mounts the world host, the Sun,
which every catalogue subject and overview is placed from. In place, a catalogue
subject keeps the mounted scene; an overview is always the host's, as zooming out
of any system reaches it. Their pages carry none of the scene's own selections
(`dataset`, `feature`), so a cold open never reads them as the host's.

`SCENE_OBJECTS` filters `OBJECTS` by scene capability. Routes, body preparation
and scene conformance use this filter because a prepared focus does not own
another scene. `requireObject` resolves either destination kind;
`requireSceneObject` rejects a focus when a caller needs a scene loader.

One object has one id. A catalogue row that an object package details takes the
package's id when the catalogue is prepared: Andromeda is `m31` in the catalogue,
the registry, its page and its links, and the LVDB key `m_031` stays in its source
references. Non-navigable context resources remain outside `OBJECTS`.
Adding a classification does not add a renderer, shell or camera owner.

`sceneHostId` identifies the scene displaying a prepared focus. A galaxy's
`hostId` identifies its physical host. Referenced hosts excluded from positional
selection remain in the catalogue's `unpositionedHosts`, with a source reference
and exclusion reason. They acquire no position or destination. The reader rejects
missing hosts, duplicate identities and cycles, including self-hosting.

## Planetary systems

A planetary system is a star and every prepared body whose orbit chain leads
back to it. The Solar System is the Sun's; WASP-43 and its planet WASP-43b form
another. [`object-systems.mts`](../site/object-systems.mts) derives systems from
the prepared world context and the registry, so no list names them. Every
member shares its star's `systemName`, and the derivation fails otherwise. A
star without orbiting bodies, such as Betelgeuse, belongs to no system.

Inside a stellar system, every nonstellar host with prepared satellite children
has a [satellite-system selection](satellite-system-navigation.md). Its
`?view=satellites` URL and `satellite-system:<host-id>` identity name the family;
the plain host and satellite routes name individual bodies. The family uses the
host's mounted scene and the same world camera.

![The WASP-43 system overview: the star, WASP-43b and its orbit, with the system's card](images/wasp-43-system-overview.png)

Each system has the same overview, `?overview=system` on its star's route:

- Zooming out of a member past the system's exit distance opens that system's
  overview, never another's. The Sun's exit is 100 AU; other systems scale it
  by their prepared framing radius, so WASP-43's is 0.05 AU. An exit is never
  farther than a quarter of where the system's orbits are gone, so its overview
  lasts at least two doublings of distance, wider than a mouse-wheel step; only
  Sgr A*'s, at 0.8 ly, is held by this.
- Approaching the star opens its card once its disc is 48 px wide and the zoom
  has passed halfway from the system framing to the close-up.
- Orbit lines, markers and labels fade with the camera's distance from their
  own star, and the overview gives way to the Milky Way once they have faded,
  by that same distance.
- Every larger scope is measured from that star too, so zooming out gives the
  same sequence of cards whichever way the camera faces (the renderer still
  fades the Milky Way by the distance from the Sun). A star past the Milky Way's
  own boundary, in the Magellanic Clouds, goes from its system to the Local
  Group.
- Breadcrumbs, the overview card, its results and the Milky Way's Systems list
  name the object's own system. The Milky Way, Local Group and Nearby Universe
  are pages of the Sun's scene, `/milky-way/` and so on, measured from the Sun
  there.
  Another star's scene zoomed out that far keeps its route, `?overview=system`,
  so its URL reopens the scene it shows.

A star or body outside every system keeps its scene until the camera is as far
from it as the Sun is, then hands off to the galactic scopes.

## Distances

The navigation preparer publishes the displayed value, its unit and a common
metre value for sorting together. Runtime only presents and sorts those values.

* Body distances are geometric distances from the Sun, calculated from the
  prepared world position at the frame’s stated Julian date in TT.
* Galaxy and nebula distances retain the adopted catalogue measurements. Their
  measurement epochs are source-specific; the shared navigation epoch is not
  presented as the epoch of those measurements.
* Cluster distances are labelled as redshift-derived **comoving** distances.
  Sorting their numeric values with nearby distances is a navigation convenience,
  not a claim that the scientific quantities are interchangeable.

Catalogue readers check the prepared Cartesian position against the adopted
right ascension, declination and distance in `sun-icrf`. The relative component
tolerance is `1e-10`, allowing the producer's 12-significant-digit rounding.
This checks derivation consistency, not independent scientific accuracy.

A distance describes its row's subject unless `distance.subject` identifies a
different measured subject, its relationship and the adoption reason. M45 records
the Pleiades stellar cluster as the measured subject; navigation carries that
qualification into the distance description. It does not label the cluster's
uncertainty as a measurement of each dust filament.

The legacy descriptor field `catalog.distanceAu` mixed orbital references,
nominal spacing and positions. It is no longer published in an application
object or used by search. Existing nominal Sun-sprite preparation still reads
its authored reference; orbital elements remain in their source-owned recipes.

## Citations and observation attribution

Galaxy references retain the author’s bibliography key. Preparation resolves
that key using the pinned LVDB bibliography, or an explicitly bound separate
source such as the SMC distance paper. The resulting paper link is a citation
transcribed from the retained source, not a claim that the linked paper’s bytes
have the bibliography file’s hash. Unresolved distance, sky-position,
half-light-radius or membership references fail catalogue validation.

Each retained galaxy or cluster bibliography entry also names a canonical
`catalogueId` in `src/sources/`. Spatial measurement citations join the shared
Sources usage graph, keyed by object and quantity; missing or conflicting
bibliography bindings fail preparation. These edges create no dataset view.

Prepared provenance products declare `observationAttribution` as `source-lineage`
or `none`. The former permits a view to credit capture information on its
underlying sources. It does not classify the output as a direct observation or
qualify its physical reconstruction. Illustrative products select `none`;
processing labels and descriptive interpretation text do not drive this
decision. Parent products excluded from observation attribution cannot supply
capture credit to a derived preview. Ordinary source lineage remains intact.
Older documents remain readable, but the contribution compiler rejects products
without an explicit decision and requires regeneration.

Dataset-view lists count selectable presentations, not papers, archive products
or independent observations. The source and product graphs retain those separate
identities. See [object provenance](object-provenance.md) for their lineage.

## Checks

`site/test/navigation-ontology.test.mts` compares every prepared spatial subject
with the registry and search, checks every body distance against its prepared
frame, and resolves the actual galaxy references. The bibliography tests reject
conflicting keys and invalid locators. Contribution tests distinguish view
counts from product counts and reject undeclared observation attribution.

`pnpm test:node` checks the router with injected scene and world-context
owners. Its test preload rejects accidental use of application boot; it does
not prove the Vite-generated context inventory or browser startup.

Scene conformance remains derived from the scene capability filter. Run
`pnpm test:node` (the browser suites were retired; the shell invariants they asserted are checked from the built HTML in `site/test/rendered-page.test.mts`, and scene retention in `site/test/scene-session.test.mts`) to check prepared-focus search, selection, saved links and retained
camera ownership. These checks do not establish the scientific accuracy of a
catalogue measurement or a reconstructed volume.
