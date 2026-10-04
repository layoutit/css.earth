export type { JsonValue, JsonRecord, ObjectDescriptor, PreparedAssetReference, PreparedObject } from './descriptor.js';
export { parseObjectDescriptor } from './parse.js';
export { objectPageCss } from './page-style.js';
export { bankCataloguePoints, parseImageLayerBankDescriptor } from './image-layer-bank.js';
export type { ImageLayerBankDescriptor } from './image-layer-bank.js';
export { parseCataloguePointBankDescriptor } from './catalogue-point-bank.js';
export type { CataloguePointBankDescriptor } from './catalogue-point-bank.js';
export { parseDensityVolumeFrame, parseDensityVolumeObjectDescriptor } from './density-volume.js';
export { CATALOGUE_CELL_POINTS, CATALOGUE_POINTS_SCHEMA, MAX_CATALOGUE_POINTS, parseCatalogueCells, parseCataloguePointSpread } from './catalogue-points.js';
export type { CatalogueCells, CataloguePointSpread } from './catalogue-points.js';
export type { DensityVolumeFrame, DensityVolumeObjectDescriptor, DensityVolumePreparationReference, VolumeQuaternion, VolumeVector } from './density-volume.js';
export { parseAuthoredObjectDescriptor, parseAuthoredRecipe } from './authored.js';
export type { AuthoredObjectDescriptor, AuthoredRecipe, CutawayRecipe, DestinationsRecipe, FeaturesRecipe, FrameBankRecipe, LayerRecipe, DatasetRecipe, MaterialRecipe, MotionRecipe, ShapeKind, ShapeRecipe, SourceReference, SurfaceRecipe, WorldFrameRecipe } from './authored.js';
export { prepareObject, readPreparedObject } from './preparation.js';
export type { ObjectPreparation } from './preparation.js';
export * from './registry/index.js';
export { PREPARED_BINARY_MAGIC, shufflePreparedBinary, unshufflePreparedBinary } from './prepared-binary.js';
export type { PreparedBinaryRegion } from './prepared-binary.js';
export * from './volume/emission/cloud-density-filter.js';
export * from './volume/compiler/compiler-bake.js';
export * from './volume/emission/coordinates.js';
export * from './volume/compiler/joint-volume.js';
export * from './volume/compiler/layer-optimization-report.js';
export * from './volume/compiler/render-element-budget.js';
export * from './volume/compiler/shape-scene.js';
export * from './volume/compiler/volume-layer-plan.js';
export * from './volume/compiler/authored-shapes.js';
export * from './volume/compiler/compiler-controls.js';
export * from './volume/compiler/compiler-star-input.js';
export * from './volume/compiler/joint-parameters.js';
export * from './volume/nebula/observation-photo.js';
export * from './volume/catalogue/prepared-catalogue-stars.js';
export * from './volume/emission/sampled-emission-fit.js';
export * from './volume/emission/sampled-recipe.js';
export * from './volume/compiler/volume-recipe.js';
export * from './volume/delivery/volume-slices.js';
export { PREPARED_CSS_OBJECT_FORMAT } from './prepared-data/runtime/object-format.js';
export { expandWorldContextSummary, expandWorldSystem } from './prepared-data/world/world-context-summary.js';
export { worldHolders } from './prepared-data/world/world-holders.js';
export type { HolderBody, WorldHolders } from './prepared-data/world/world-holders.js';
export type { Cancellation } from './volume/nebula/cancellation.js';
export type { ObservationMapping } from './volume/nebula/observation-mapping.js';
export type { SimulationDepthPrior } from './volume/nebula/simulation-prior.js';
export { parsePreparedWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldContextPlan, worldContextGeometry, orbitVertices, parsePreparedWorldSystem, extendWorldContext } from './prepared-data/world/world-context.js';
export { parseCompleteWorldContext, parsePreparedWorldIndex } from './prepared-data/world/world-index.js';
export type { PreparedContextPoint, PreparedContextPointSource, PreparedContextBody, PreparedContextOrbit, PreparedContextOrbitGeometry, PreparedContextCameraPresentation, PreparedVolumeOpacityProfile, PreparedWorldContext, PreparedWorldIndex, PreparedWorldSystem, PreparedWorldContextGeometry } from './prepared-data/world/world-context.js';
export { worldCameraOf, parsePreparedWorldCamera } from './prepared-data/camera/world-camera.js';
export { parsePreparedWorldCameraFrame } from './prepared-data/world/world-frame.js';
export type { PreparedWorldCameraFrame } from './prepared-data/world/world-frame.js';
export { decodeWorldOrbitBank, decodeWorldOrbits } from './prepared-data/orbit/world-orbit-bank.js';
export { parsePreparedSystemView } from './prepared-data/world/world-system-view.js';
export type { PreparedSystemViewCandidate, PreparedSystemView } from './prepared-data/world/world-system-view.js';
export { worldOrbitBankRegions } from './prepared-data/orbit/world-orbit-bank-regions.js';
export { worldOrbitBanks } from './prepared-data/orbit/world-orbit-encoder.js';
export type { PreparedWorldContextData, PreparedOrbitDataLod } from './prepared-data/world/world-context-data.js';
export type { LevelOfDetailPlan, OrbitLineFade } from './prepared-data/presentation/world-presentation.js';
export type { PreparedOrbitCenter } from './prepared-data/orbit/prepared-orbit-centers.js';

export { PREPARED_WORLD_CONTEXT_SCHEMA, PREPARED_WORLD_CONTEXT_SUMMARY_SCHEMA, PREPARED_WORLD_SYSTEM_SCHEMA, PREPARED_WORLD_SYSTEM_VIEW_SCHEMA, PREPARED_WORLD_ORBITS_SCHEMA } from './prepared-data/world/world-schemas.js';

export { CATALOGUE_POINTS_BINARY_SCHEMA, CATALOGUE_BANK_BINARY_MAGIC, CATALOGUE_POSITION_SCALE, encodeCatalogueBankBinary, decodeCatalogueBankBinary } from './prepared-data/catalogue/catalogue-bank-binary.js';
export { PREPARED_CSS_POINT_FIELD_SCHEMA, PREPARED_CSS_POINT_FIELD_MANIFEST_SCHEMA, POINT_FIELD_BANK_ENCODING } from './stars/point-field-schemas.js';
export { POINT_FIELD_BANK_MAGIC, POINT_FIELD_BANK_VERSION, POINT_FIELD_BANK_HEADER_BYTES, POINT_FIELD_MAGNITUDE_DIVISOR, POINT_FIELD_MAGNITUDE_BOUND, POINT_FIELD_BANK_QUANTIZATION, decodeStarMagnitude, pointFieldBankLayout, pointFieldBankHeader, pointFieldBankRegions, decodePointFieldBank } from './stars/point-field-bank.js';
export { parsePreparedCssPointFieldManifest, decodePreparedCssPointField } from './stars/point-field-validation.js';
export type { PreparedCssPointField, PreparedCssPointFieldManifest, PreparedPointFieldStar, PreparedPointFieldNode, PreparedPointFieldResource, PreparedPointFieldBank, PreparedPointFieldQuantization, PreparedPointAppearance, PointFieldRgb, PointFieldVector, PointFieldBankStorage, PreparedPointFieldBankColumn } from './stars/point-field-types.js';

export { OBJECT_RUNTIME_SCHEMA, requireObjectRuntimeDefinition, objectCycleStates, OBJECT_SPEED_STATES, SHELL_SETTING_NAMES } from './prepared-data/runtime/object-controls.js';
export type { DatasetVolume, DatasetControl, CycleState, ToggleControl, CycleControl, SettingControl, ObjectControls } from './prepared-data/runtime/object-controls.js';
export type { ObjectRuntimeDefinition } from './prepared-data/runtime/object-runtime-types.js';
export type { PreparedPoseKeyframe, PreparedWrite, PreparedSelectionNavigation, PreparedVariant, PreparedTree, PreparedViewBinding, PreparedPresentationDefinition, PreparedInteriorDisc, LeafBoxComponent, PreparedLeafBox, PreparedDepthOrder, PreparedDepthPartitions, PreparedTexturePlacements, PreparedTextureLevels, PreparedTextureTile, PreparedTextureTileLeaves, PreparedSilhouetteSteps, SurfacePoint, SurfaceTriangle, SurfaceFrontFace, PreparedSurfaceRange, PreparedSurfaceHit, SurfaceFeaturePolicy, SurfaceFeatureCatalogDescriptor, SurfaceFeatureSelectionPlan, PreparedSurfaceFeaturePlan } from './prepared-data/presentation/runtime-presentation-types.js';
export type { PreparedMaterialRotationPolicy, PreparedMaterialFrameMapping, PreparedMaterialAddress, PreparedMaterialBank, PreparedMaterialRotation, PreparedMaterialTrack, PreparedMaterialSelection, CounterTransport, EllipsoidProjectionPlan } from './prepared-data/runtime/runtime-material-types.js';
export type { PreparedResourceEntry, PreparedResourcePool, PreparedAssets, PreparedCapability, PreparedResourceFallback, PreparedAssetOrigin } from './prepared-data/runtime/runtime-resource-types.js';
export type { PitchCalibration, ResponsiveFit, CameraPlan, PerspectiveCameraPlan, CubicSkyCameraContract, CubicSkyPlan, DirectionalSunPlan } from './prepared-data/camera/runtime-camera-types.js';
export { CSS_NUMBER, cssMatrix } from './prepared-data/runtime-validation/css-matrix.js';

export { requireJsonData, requirePreparedData } from './prepared-data/runtime-validation/guards.js';
export type { RecordValue } from './prepared-data/runtime-validation/guards.js';
export { parsePreparedObjectRuntime } from './prepared-data/runtime-validation/index.js';

export { requireTextureLevels, requireTextureTileLeaves, requireTexturePlacements } from './prepared-data/runtime-validation/prepared-texture-levels.js';
export { requireVariants, requireViewBindings } from './prepared-data/runtime-validation/presentation.js';
export { requireAssets } from './prepared-data/runtime-validation/resources-tree.js';

export { requireTextureBindings } from './prepared-data/runtime-validation/texture-bindings.js';
export { PREPARED_DATASET_SCHEMA, deferredDatasetIds, preparedDatasetReference, splitPreparedDatasetTables, requireDeferredDatasets, requirePreparedDatasetTables, mergePreparedDatasetTables } from './prepared-data/content/dataset-tables.js';
export type { PreparedDatasetLevel, PreparedDatasetTables } from './prepared-data/content/dataset-tables.js';
export { requireCamera } from './prepared-data/runtime-validation/camera.js';
export { requireControls } from './prepared-data/runtime-validation/controls.js';

export { PREPARED_CUBIC_SKY_SCHEMA, CUBIC_SKY_STANDARD_SCHEMA, PREPARED_DIRECTIONAL_SUN_SCHEMA } from './prepared-data/camera/runtime-camera-types.js';

export { PREPARED_PRESENTATION_SCHEMA } from './prepared-data/presentation/prepared-presentation-schema.js';
export { validatePreparedLeafBounds } from './prepared-data/presentation/prepared-leaf-bounds.js';
export type { PreparedLeafBounds } from './prepared-data/presentation/prepared-leaf-bounds.js';
export type { PreparedContractRotation, PreparedContractBank, PreparedContractTrack, PreparedContractVariant } from './prepared-data/presentation/prepared-presentation-contract-types.js';

export { PREPARED_CSS_SKY_SCHEMA } from './prepared-data/sky/css-sky-types.js';
export type { PreparedCssSky, PreparedSkyResources, PreparedSkyVector } from './prepared-data/sky/css-sky-types.js';
export { validatePreparedCssSky, validatePreparedSkyParallax } from './prepared-data/sky/css-sky-validation.js';
export type { PreparedCubicSkyPlan, PreparedDirectionalSunPlan } from './prepared-data/camera/runtime-camera-types.js';
export { DIRECTIONAL_SUN_PRESENTATION_STANDARD_SCHEMA } from './prepared-data/camera/runtime-camera-types.js';
export { validatePreparedCubicSky, validateDirectionalSunPlan } from './prepared-data/sky/sky-contract.js';

export type { VolumeAxis, PreparedVolumeLeafStyle, PreparedVolumeLeaf, PreparedVolumeStack, PreparedVolumeImpostors, PreparedCssVolume } from './volume/delivery/css-volume-types.js';
export { validatePreparedCssVolume } from './volume/delivery/css-volume-validation.js';
export { validateVolumeImpostors } from './volume/delivery/volume-impostor-validation.js';
export { validatePreparedCataloguePoints } from './volume/catalogue/prepared-catalogue-points.js';
export type { PreparedCataloguePoint, PreparedCataloguePoints } from './volume/catalogue/prepared-catalogue-points.js';
export { DEFAULT_POINT_VISIBILITY } from './volume/catalogue/point-visibility.js';
export type { PreparedPointVisibility } from './volume/catalogue/point-visibility.js';
export { validatePreparedVolumeDatasets, samePreparedCatalogueGeometry, samePreparedPhysicalFrame } from './volume/delivery/prepared-volume-datasets.js';
export type { PreparedVolumeDatasetBrightness, PreparedVolumeDataset, PreparedVolumeDatasets, PreparedVolumeDatasetBank } from './volume/delivery/prepared-volume-datasets.js';
export type { PreparedImageLayerBank, PreparedImageLayerLeaf, PreparedImageLayerView, PreparedCssImageLayers } from './volume/delivery/image-layer-bank-types.js';
export { validatePreparedImageLayerBank } from './volume/delivery/image-layer-bank-validation.js';
export type { PreparedCssSurfaceShell } from './prepared-data/surface/css-surface-shell-types.js';
export { validatePreparedCssSurfaceShell } from './prepared-data/surface/css-surface-shell-validation.js';
export { PREPARED_CSS_VOLUME_SCHEMA, PREPARED_VOLUME_IMPOSTORS_SCHEMA, PREPARED_VOLUME_DATASETS_SCHEMA, PREPARED_IMAGE_LAYER_BANK_SCHEMA, DENSITY_VOLUME_FORMAT } from './volume/delivery/volume-schemas.js';
export { PREPARED_CSS_SURFACE_SHELL_SCHEMA, SURFACE_SHELL_FORMAT, SHELL_CORNER_PERMUTATIONS } from './prepared-data/surface/css-surface-shell-types.js';

export { readCataloguePointBank, parseCataloguePointSteps } from './prepared-data/catalogue/catalogue-point-bank.js';
export type { CataloguePointLevel, PreparedCataloguePointBank } from './prepared-data/catalogue/catalogue-point-bank.js';
export { GALAXY_BACKING_SCHEMA, parseGalaxyBacking } from './prepared-data/catalogue/galaxy-backing.js';
export type { BackingNearFade, PreparedGalaxyBacking } from './prepared-data/catalogue/galaxy-backing.js';
export { IMAGE_MESH_SCHEMA, parseImageMesh } from './prepared-data/presentation/image-mesh.js';
export type { PreparedImageMesh } from './prepared-data/presentation/image-mesh.js';
export { DATASET_BILLBOARDS_SCHEMA, parseDatasetBillboards } from './prepared-data/content/dataset-billboards.js';
export type { DatasetBankBillboard, DatasetBillboardView, DatasetBillboards } from './prepared-data/content/dataset-billboards.js';
export { PREPARED_GALAXY_CATALOG_SCHEMA, parsePreparedGalaxyCatalog } from './prepared-data/catalogue/galaxy-catalog.js';
export type { SpatialCitation, SpatialCatalogSource, SpatialMeasurement, PreparedGalaxyRecord, PreparedGalaxyCatalog } from './prepared-data/catalogue/galaxy-catalog.js';
export { PREPARED_CLUSTER_CATALOG_SCHEMA, isPreparedCluster, parsePreparedClusterCatalog } from './prepared-data/catalogue/cluster-catalog.js';
export type { PreparedClusterRecord, PreparedCatalogObject, PreparedClusterCatalog } from './prepared-data/catalogue/cluster-catalog.js';
export { PREPARED_NEBULA_CATALOG_SCHEMA, isPreparedNebula, parsePreparedNebulaCatalog } from './prepared-data/catalogue/nebula-catalog.js';
export type { PreparedNebulaRecord, PreparedNebulaCatalog } from './prepared-data/catalogue/nebula-catalog.js';
export type { DistanceSubject, UnpositionedHost } from './prepared-data/catalogue/spatial-relations.js';
export { PREPARED_SURFACE_FEATURES_SCHEMA } from './prepared-data/surface/surface-feature-types.js';
export type { SurfaceFeatureKind, SurfaceFeatureOutline, SurfaceFeatureAxes, PreparedSurfaceFeature, PreparedSurfaceFeatureCatalog, ParsedSurfaceFeature, ParsedSurfaceFeatureCatalog, TraceSummary, SurfaceFeatureLandmarkEvidence } from './prepared-data/surface/surface-feature-types.js';
export { parsePreparedSurfaceFeatureCatalog } from './prepared-data/surface/surface-feature-catalog.js';
export { GALAXY_DISPLAY_SAMPLE_SCHEMA, parseGalaxyDisplaySample } from './prepared-data/catalogue/galaxy-display-sample.js';
export type { PreparedGalaxyDisplaySample, GalaxyDisplaySample } from './prepared-data/catalogue/galaxy-display-sample.js';

export { EMISSION_FIELD_SCHEMA } from './volume/emission/emission-field-types.js';
export type { EmissionComponent, EmissionFieldModel } from './volume/emission/emission-field-types.js';
export { readRetainedEmissionField } from './volume/emission/retained-emission.js';
export { readEmissionWindow } from './volume/emission/emission-window.js';
export type { EmissionWindow } from './volume/emission/emission-window.js';
export { validateEnvelopeSettings, SIMULATION_ENVELOPE_SCHEMA, readSimulationEnvelopeRecord } from './volume/nebula/simulation-envelope.js';
export type { SimulationEnvelopeSettings, SimulationEnvelopeRecord } from './volume/nebula/simulation-envelope.js';
export { PHOTOMETRIC_MGE_SCHEMA, readPhotometricMgeRecipe, readPublishedPhotometricMgeRecipe } from './volume/emission/photometric-mge.js';
export type { PhotometricGaussian, PhotometricMgeRecipe } from './volume/emission/photometric-mge.js';
export { PHOTOMETRIC_ENVELOPE_SCHEMA, readPhotometricEnvelope, readEnvelopeColors } from './volume/emission/photometric-emission.js';
export type { RetainedPhotometricEnvelope, EnvelopeColors } from './volume/emission/photometric-emission.js';
export { DATASET_TONE_CURVE_SCHEMA, validateDatasetToneCurve } from './volume/emission/dataset-tone-curve.js';
export type { DatasetToneCurve } from './volume/emission/dataset-tone-curve.js';
export { COMPACT_COMPILER_SCHEMA, readCompactCompiler } from './volume/compact/compact-compiler.js';
export type { CompactCompilerMaterial, CompactCompilerResource } from './volume/compact/compact-compiler.js';
export { CLOUD_PARTS_SCHEMA, parseCloudCatalogue } from './volume/catalogue/cloud-parts.js';
export type { CloudPartKind, CloudPart, CloudCatalogue } from './volume/catalogue/cloud-parts.js';

export { COMPACT_SYMMETRY_SCHEMA, readCompactSymmetry, decodeCompactSymmetryField } from './volume/compact/compact-symmetry.js';
export { COMPACT_SAMPLED_SCHEMA, readCompactSampled, decodeCompactPointColors, encodeCompactPointColors } from './volume/compact/compact-sampled.js';
export type { CompactSampledColor } from './volume/compact/compact-sampled.js';
export { COMPACT_FINITE_EMISSION_SCHEMA, COMPACT_FINITE_EMISSION_METHOD, readCompactFiniteEmission, readCompactFiniteDataset, readCompactToneProjection } from './volume/compact/compact-finite-emission.js';
export { COMPONENT_MATERIAL_SCHEMA, readComponentMaterialReceipt } from './volume/emission/component-material-receipt.js';
export type { ComponentMaterialColor, ComponentMaterialReceipt } from './volume/emission/component-material-receipt.js';

export { CANONICAL_PREPARED_IMAGE_DENSITY, canonicalPreparedAsset, preparedResourcePool } from './prepared-data/runtime/prepared-object-assets.js';
export type { PreparedAssetPair, PreparedResourcePoolOptions } from './prepared-data/runtime/prepared-object-assets.js';

export { surfaceFeatureBankIndex } from './prepared-data/surface/surface-feature-banks.js';

export { CSS_COMPILER_RENDER_BUDGET } from './volume/compiler/compiler-render-budget.js';

export { PREPARED_INTERIOR_DISC_SIZE } from './prepared-data/presentation/prepared-interior-disc-size.js';

export { tiledTextureKeys, textureTileLeafStyles } from './prepared-data/runtime/prepared-texture-tile-styles.js';

export { shellMaterialAddress } from './prepared-data/surface/shell-material-address.js';

export { IMPERCEPTIBLE_LUMINANCE } from './stars/point-field-luminance.js';

export { requireObjectControls } from './prepared-data/surface/shell-controls.js';
export type { ShellObjectControls } from './prepared-data/surface/shell-controls.js';

export { validateMarkerPresentation } from './prepared-data/presentation/marker-presentation.js';
export type { MarkerPresentation } from './prepared-data/presentation/marker-presentation.js';

export { samePreparedVolumeTopology } from './volume/delivery/prepared-volume-topology.js';

export { RENDER_ELEMENT_PROFILE_SCHEMA } from './volume/compiler/render-element-budget.js';

export { parsePreparedDensityVolume, parsePreparedDensityVolumeText } from './prepared-data/runtime/prepared-density-volume.js';
export { AUTHORED_OBJECT_SCHEMA } from './authored.js';
export { SOURCE_MANIFEST_SCHEMA } from './sources/source-manifest-schema.js';
export { OBJECT_PAGE_SCHEMA } from './prepared-data/content/object-page-schema.js';
export { OBJECT_SCHEMA, PREPARED_OBJECT_SCHEMA } from './descriptor.js';

export { OBJECT_TEXT_SCHEMA, PREPARED_TEXT_SCHEMA, parseCitedText, parseObjectText, parsePreparedText, type TextCitation, type CitedText, type ObjectTextDataset, type ObjectText, type PreparedObjectText } from './prepared-data/content/object-text.js';
export { ARCHIVED_CAMERA_SCHEMA, archivedCameraFields, parseArchivedCamera, parseMatrixArchivedCamera, type ArchivedCamera, type SpiceCamera } from './prepared-data/camera/archived-camera.js';
export { PREPARED_DESTINATIONS_SCHEMA, parsePreparedDestinations, readDestinationSettlements, type PreparedDestination, type PreparedDestinations, type DestinationSearchRecord } from './prepared-data/content/prepared-destinations.js';
export { AUTHORED_PREPARATION_SCHEMA, type AuthoredPreparationReceipt, readAuthoredPreparationSources, readPublishedPreparationSources } from './prepared-data/source/authored-preparation.js';
export { WORLD_NAVIGATION_PREPARATION_SCHEMA, type WorldNavigationPreparationReceipt, samePreparedWorldFrame, requireWorldNavigationReceiptIdentity, requireWorldNavigationReceiptContext } from './prepared-data/world/world-navigation-preparation.js';
export { PREPARED_FEATURES_SCHEMA, type PreparedFeaturesDescriptor, readPreparedFeaturePins } from './prepared-data/surface/prepared-features.js';
export { WISE_ATLAS_TILES_SCHEMA, WISE_BAND_NAMES, parseTilePins, type WiseBand, type TilePins } from './prepared-data/surface/wise-atlas-tiles.js';
export { DISPLAY_ORIENTATION_SCHEMA, parseAuthoredOrientation, type DisplayOrientation } from './prepared-data/orbit/display-orientation.js';
export { SYNCHRONOUS_ROTATION_SCHEMA, parseSynchronousRotation, type SynchronousRotation } from './prepared-data/orbit/synchronous-rotation.js';
export { PUBLISHED_LIMB_DARKENING_SCHEMA, readPublishedPowerLaw, readPublishedLimbDarkening, checkLimbLaw, type LimbLaw, type PublishedLimbCoefficient, type PublishedLimbDarkening } from './prepared-data/photometry/published-limb-darkening.js';

export { DISC_INTEGRATED_COLOR_SCHEMA, parseDiscColor, parseDiscColorRecord, parseDiscColorPhotometry, type DiscColorRecord, type DiscColorPhotometry } from './prepared-data/photometry/disc-integrated-color.js';
export { STELLAR_PHOTOMETRIC_COLOR_SCHEMA, PLANCK_FLOOR_KELVIN, parseStellarColorRecord, parseMeasuredSpectrumRecord, checkStellarTemperature, type StellarColorRecord, type StellarTemperature, type MeasuredSpectrumRecord } from './prepared-data/photometry/stellar-photometric-color.js';
export { UNIFORM_DISC_STAR_SCHEMA, parseUniformDiscStarMeasurements, type UniformDiscStarMeasurements } from './prepared-data/photometry/uniform-disc-star.js';
export { MEASURED_SPECTRUM_SCHEMA, parseMeasuredSpectrumDocument, type Measurement } from './prepared-data/photometry/measured-spectrum.js';
export { DENSITY_PLACEMENT_SCHEMA, parseDensityPlacement, type DensityPlacement } from './volume/emission/density-placement.js';
export { OBSERVED_STELLAR_CATALOGUE_SCHEMA, isStellarCoordinate, readObservedStellarCatalogueEnvelope, parseObservedStellarCatalogue,
  type ObservedStar, type PhotometryKind, type ObservedStellarCatalogueEnvelope, type ObservedStellarCatalogue } from './volume/catalogue/observed-stellar-catalogue.js';
export { CAMERA_POSE_SCHEMA, parseCameraPose, parseCameraPoseMatrix, parseRestoredCameraPose, type CameraPose } from './prepared-data/camera/camera-pose.js';
export { OBJECT_CONTENT_SCHEMA, OBJECT_CONTENT_VERSION, validateObjectContentEnvelope, authoredDatasetMetadata, type DatasetLegendRecipe, type DatasetSource, type ContentDatasetRecipe, type DatasetStep, type ChartRecipe, type GalleryRecipe, type ObjectContentSource, type Fact } from './prepared-data/content/object-content.js';
export { PREPARED_CONTENT_SCHEMA, parsePreparedPanelContent, type PreparedObjectContent, type PreparedObjectContentDocument, type PreparedTitle, type ObjectTitle, type Chart, type GalleryItem, type Gallery, type PreparedPanelContent } from './prepared-data/content/prepared-content.js';
export { FACILITY_EMBLEMS_SCHEMA, readFacilityEmblemSource, parseFacilityEmblemLibrary, parseFacilityEmblemImage, type FacilityEmblemEntry, type FacilityEmblemLibrary } from './prepared-data/content/facility-emblems.js';

// E2-rest: P1
export { PUBLISHED_MUTUAL_ORBIT_SCHEMA, PUBLISHED_BODY_EPOCH_EPHEMERIS_SCHEMA, SOLAR_SYSTEM_PREPARATION_SCHEMA, INVESTIGATION_LEDGER_SCHEMA, ACQUISITION_PLAN_SCHEMA } from './prepared-data/source/source-schema-identifiers.js';
export type { AcquisitionOperation, AcquisitionPlan } from './prepared-data/source/acquisition-plan.js';
export { INVESTIGATION_STATUSES, type InvestigationStatus, type InvestigationEntry, type InvestigationLedger, type FacilityInvestigationLedger } from './prepared-data/source/investigation-ledger.js';
// E2-rest: P2
export { CSS_PRESENTATION_PROFILE_SCHEMA, parsePresentationProfile, type PresentationProfile } from './prepared-data/presentation/css-presentation-profile.js';
export { CSS_GEOMETRY_PROFILE_SCHEMA, NAVIGATION_MARKER_SCHEMA, PAGED_ELLIPSOID_SCHEMA, CHART_ASSETS_SCHEMA } from './prepared-data/presentation/presentation-recipe-schemas.js';
export { MARKER_SOURCE_HINTS, type MarkerSource, type MarkerOperation, type MarkerDescriptor } from './prepared-data/presentation/navigation-marker.js';
// E2-rest: P3
export { VOLUME_DATASET_MANIFEST_SCHEMA, parseVolumeDatasetManifest, type VolumeDatasetManifestPolicy } from './volume/delivery/volume-dataset-manifest.js';
export { COMPACT_DENSITY_DELIVERY_SCHEMA, parseCompactDensityDelivery, parseCompactDensityInputs } from './volume/compact/compact-density-delivery.js';
export { NEBULA_DEPTH_MODEL_SCHEMA, type DepthSurface, type DepthRecipe } from './volume/nebula/nebula-depth-model.js';
export { GAIA_NEBULA_FIELD_SCHEMA, parseGaiaNebulaField, type GaiaNebulaFieldDocument, type GaiaNebulaFieldStar, type GaiaNebulaFieldSelection, type GaiaNebulaCatalogueField, type GaiaNebulaAstrometryRow, type GaiaNebulaFieldSubset } from './volume/nebula/gaia-nebula-field.js';
export { NEBULA_DELIVERY_SCHEMA, readNebulaDelivery, type NebulaDelivery, type NebulaSkyFrame } from './volume/nebula/nebula-delivery.js';
export { CIRCUMSTELLAR_RECONSTRUCTION_SCHEMA, type CircumstellarOpacity, type EdgeOnReconstruction } from './volume/nebula/circumstellar-reconstruction.js';
// E2-rest: P4
export { PYUVDATA_UVFITS_SCHEMA, parsePyuvdataUvfitsRequest, parsePyuvdataUvfitsAnswer, type PyuvdataUvfitsRequest, type PyuvdataUvfitsAnswer } from './prepared-data/source/pyuvdata-uvfits.js';
export { VOLUME_SOURCE_MANIFEST_SCHEMA, parseVolumeSourceManifest, parseVolumeContextProducts, type VolumeManifestReader, type VolumeContextProduct } from './prepared-data/source/volume-source-manifest.js';
export { VOLUME_PRESENTATION_SOURCE_SCHEMA, parseVolumeSourcePreview, isTrackedVolumeSourcePreview, type VolumeSourcePreview, type TrackedVolumeSourcePreview, type VolumeDatasetSource, type VolumePresentationSource } from './prepared-data/source/volume-presentation-source.js';
export { parseGeometryProfile, type GeometryProfile, type SeamOutsetProfile, type SurfaceGeometryProfile } from './prepared-data/presentation/css-geometry-profile.js';
export { parseDepthRecipe, readPublishedDepthRecipe } from './volume/nebula/nebula-depth-model.js';
export { parseAcquisitionPlan, type AcquisitionValidationPolicy } from './prepared-data/source/acquisition-plan.js';
export { evidenceLink, parseInvestigationLedger, parseFacilityLedger, type InvestigationEntryExpansion } from './prepared-data/source/investigation-ledger.js';
export { parseMeasuredSpectrum, type MeasuredSpectrumRecipe, type MeasurementSource } from './prepared-data/photometry/chart-measured-spectrum.js';
export { parseRetrievedProfile, type RetrievedProfileRecipe, type ProfileSource } from './prepared-data/photometry/chart-retrieved-profile.js';
export { parseSystemOrbits, type SystemOrbitsRecipe } from './prepared-data/photometry/chart-system-orbits.js';
export { parseChartAssetRecipe, chartSourcePath, type ChartAssetRecipe } from './prepared-data/photometry/chart-assets.js';
export { parseSpectrumRecipe, type SpectrumRecipe } from './prepared-data/photometry/chart-spectrum.js';
export { responsiveFit, cameraFields, camera, recipeCamera, DERIVED_CAMERA_ANGLE_FIELDS } from './prepared-data/camera/authored-camera.js';
export { parsePagedRecipe, parsePagedDatasetBindings, isPagedEllipsoidRecipe, type PagedDatasetBindings, type PagedEllipsoidRecipe, type PagedGeometryParameters } from './prepared-data/presentation/paged-ellipsoid.js';
export { parseSolarSceneSource, type SolarSceneSource, type SolarSource } from './prepared-data/orbit/solar-system-preparation.js';
export * from './prepared-data/surface/resolution-evidence.js';
export * from './prepared-data/photometry/limb-block.js';
export * from './prepared-data/surface/raster-recipe.js';
export { parseRasterRecipe } from './prepared-data/surface/raster-recipe-parser.js';
export * from './prepared-data/surface/body-map-product.js';
export * from './prepared-data/source/telescope-product.js';
export * from './prepared-data/source/vo-discovery.js';
export { parsePublishedBodyEpochRecord, parsePublishedParameters, type PublishedRecord, type PublishedParameters, type SourcePin, type HorizonsPin, type ProjectionSample } from './prepared-data/orbit/published-orbit.js';
export * as preparedPanelReaders from './prepared-data/content/panel-readers.js';
export { parseCloudAppearance, DEFAULT_CLOUD_APPEARANCE, type CloudAppearance } from './volume/emission/cloud-appearance.js';
export { validateChannelGain, type ChannelGain } from './volume/emission/channel-gain.js';

export { sourceRecordReaders } from './prepared-data/source/source-record-readers.js';

export type { DeliveryAssertion, DeliveryValidationPolicy } from './volume/delivery/delivery-validation-policy.js';

export { SHAPE_MODEL_SCHEMA, readShapeModelDiscovery, readRuntimeCamera, readRuntimeCameraPrefix } from './prepared-data/source/discovery-readers.js';
export { parseVolumePresentationSource } from './prepared-data/source/volume-presentation-source.js';
export { readChartAssetRecipe, readSourceManifestInputs, readFeatureSearchCatalog, readRuntimeFeatureDatasets, readRasterDiscovery } from './prepared-data/presentation/build-projections.js';
export { SYSTEM_TEXT_SCHEMA, readSystemText } from './prepared-data/presentation/build-projections.js';
export { readObjectContentDatasets, readObjectContentPanel } from './prepared-data/content/object-content.js';
export { readCataloguePresentationDistances } from './prepared-data/presentation/build-projections.js';
export { type FormatReaderPolicy } from './prepared-data/source/format-reader-ledger.js';
export { PREPARED_VOLUME_PRESENTATION_SCHEMA, DENSITY_VOLUME_DATASET_BANK_SOURCE_SCHEMA, readVolumePresentationPreviews, readVolumeAttachment, readGalaxyBackingSource } from './prepared-data/presentation/build-projections.js';
export { hasVolumePresentationSource } from './prepared-data/source/volume-presentation-source.js';
export { WORLD_CONTEXT_SOURCE_SCHEMA, readWorldContextSourceSelection, STELLAR_EXTENT_SOURCE_SCHEMA, readStellarExtent } from './prepared-data/presentation/build-projections.js';
export { readPreparedPanelContentRecord, readComparableSource, readObjectDescriptorRecord } from './prepared-data/presentation/build-projections.js';
export { readStellarDotMeasurements, readFeatureMapLongitude } from './prepared-data/presentation/build-projections.js';

export { PACKAGED_POINTS_SOURCE_SCHEMA, readPackagedPointsFrame } from './prepared-data/presentation/build-projections.js';

export { HOSTED_PLANET_MEASUREMENTS_SCHEMA, NEUTRON_STAR_MEASUREMENTS_SCHEMA, readPreparedChartContentRecord } from './prepared-data/presentation/build-projections.js';

export { MAP_SPHERE_DATASETS_SCHEMA, readMapSphereDatasetPreviews } from './prepared-data/surface/map-sphere-datasets.js';
export { LEAF_BOX_PROPERTY, LEAF_BOX_FACTOR, SURFACE_SEAM_OUTSET_PROPERTY } from './prepared-data/presentation/leaf-box-properties.js';
export { requirePresentationEnvelope } from './prepared-data/runtime-validation/presentation-envelope.js';
