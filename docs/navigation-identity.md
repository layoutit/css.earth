# Navigation identity and evidence

`OBJECTS` is the application inventory of navigable subjects. It combines
registered body packages with subjects from the prepared galaxy, cluster and
nebula catalogues. Search, aliases and classification tabs use this inventory.

| Concept | Meaning and owner |
| --- | --- |
| Scene destination | A body package with a route, prepared world frame and scene loader. |
| Prepared-focus destination | A catalogue subject selected on the existing scene’s shared camera. Its canonical URL records a host scene and `focus` identity. |
| Rendering resource | A volume, image bank, point field or other prepared content. A resource descriptor alone does not publish a destination. |
| Dataset view | A selectable `(objectId, lensId)` presentation, which may combine several products and published sources. |
| Published source | A scientific work, release or product identified in the source catalogue; a local file hash identifies retained bytes separately. |

`SCENE_OBJECTS` filters `OBJECTS` by scene capability. Routes, body preparation
and scene conformance use this filter because a prepared focus does not own
another scene. `requireObject` resolves either destination kind;
`requireSceneObject` rejects a focus when a caller needs a scene loader.

The local-group catalogue’s `m_031` is the Andromeda destination. `m31` names
its image resource through `detailedObjectId`; it does not create a second
navigable Andromeda. Non-navigable context resources remain outside `OBJECTS`.
Adding a classification does not add a renderer, shell or camera owner.

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

`pnpm test:shell:router` checks the router with injected scene and world-context
owners. Its test preload rejects accidental use of application boot; it does
not prove the Vite-generated context inventory or browser startup.

Scene conformance remains derived from the scene capability filter. Run
`pnpm test:browser:ontology <origin>` to check prepared-focus search, selection, saved links and retained
camera ownership. These checks do not establish the scientific accuracy of a
catalogue measurement or a reconstructed volume.
