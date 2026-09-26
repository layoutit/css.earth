import type { LightingRecipe, RasterRecipe } from './config.js';
import { resolveLightingRecipe } from './lighting-banks.js';
import { parseLimbBlock } from '@cssearth/bake/photometry';
type RecordValue = Record<string, unknown>;
function record(value: unknown, path: string): RecordValue { if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError(`${path} must be an object.`); return value as RecordValue; }
function finite(value: unknown, path: string, positive = false): asserts value is number { if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0))
    throw new TypeError(`${path} must be ${positive ? 'positive and ' : ''}finite.`); }
function text(value: unknown, path: string): asserts value is string { if (typeof value !== 'string' || !value.length)
    throw new TypeError(`${path} must be nonempty text.`); }
function numbers(value: unknown, path: string, length?: number): asserts value is number[] { if (!Array.isArray(value) || !value.length || (length !== undefined && value.length !== length))
    throw new TypeError(`${path} has invalid dimensions.`); value.forEach((item, index) => finite(item, `${path}[${index}]`)); }
function path(value: unknown, label: string): void { text(value, label); if (value.startsWith('/') || value.split('/').includes('..') || value.includes('\\'))
    throw new TypeError(`${label} must be a contained relative path.`); }
function fields(value: RecordValue, keys: string[], label: string, positive = false): void { for (const key of keys)
    finite(value[key], `${label}.${key}`, positive); }
export function parseRasterRecipe(value: unknown): RasterRecipe {
    const recipe = record(value, 'raster');
    if (recipe.schema !== 'cssearth-raster-recipe@1')
        throw new TypeError('Unsupported raster recipe schema.');
    fields(recipe, ['sourceWidth', 'sourceHeight', 'width', 'height', 'latitudeBands', 'polarTile'], 'raster', true);
    for (const key of ['sourceWidth', 'sourceHeight', 'width', 'height', 'latitudeBands', 'polarTile'])
        if (!Number.isInteger(recipe[key]))
            throw new TypeError(`raster.${key} must be an integer.`);
    if (recipe.resample !== 'source-packed' && recipe.resample !== 'density-before-pack')
        throw new TypeError('Unknown raster resampling operator.');
    if (recipe.unpackedResizeBeforePack !== undefined && recipe.unpackedResizeBeforePack !== true)
        throw new TypeError('unpackedResizeBeforePack must be true when declared.');
    if (recipe.unpackedResizeBeforePack && recipe.resample !== 'source-packed')
        throw new TypeError('unpackedResizeBeforePack needs source-packed storage.');
    if (recipe.polarProjection !== 'angular-nearest' && recipe.polarProjection !== 'orthographic-bilinear')
        throw new TypeError('Unknown polar projection operator.');
    if (recipe.missingCoverage !== undefined && recipe.missingCoverage !== 'gray' && recipe.missingCoverage !== 'dark')
        throw new TypeError('Unknown missing-coverage fill.');
    if (recipe.polesCombined !== undefined)
        throw new TypeError('Every lens writes its own poles (polesOutput with {id}); remove polesCombined.');
    // Angular poles sample the whole source map, which only the source-packed lane keeps in memory.
    if (recipe.polarProjection === 'angular-nearest' && recipe.resample !== 'source-packed')
        throw new TypeError('Angular-nearest poles need source-packed storage.');
    if (recipe.densities !== undefined)
        throw new TypeError('The raster lane prepares one canonical density; remove densities.');
    text(recipe.publicBase, 'publicBase');
    if (!recipe.publicBase.startsWith('/') || !recipe.publicBase.endsWith('/') || recipe.publicBase.includes('..'))
        throw new TypeError('publicBase must be an absolute asset URL prefix.');
    path(recipe.polesOutput, 'polesOutput');
    if (!String(recipe.polesOutput).includes('{id}'))
        throw new TypeError('polesOutput must name each lens ({id}): every lens writes its own poles.');
    const metadata = record(recipe.surfaceMetadata, 'surfaceMetadata');
    text(metadata.schema, 'surfaceMetadata.schema');
    if (metadata.sourcePositionVariable !== undefined)
        throw new TypeError('surfaceMetadata.sourcePositionVariable is gone: leaves write their texture address inline.');
    const thumbnail = record(recipe.thumbnail, 'thumbnail');
    fields(thumbnail, ['size'], 'thumbnail', true);
    if ('quality' in thumbnail) throw new TypeError('thumbnail.quality is no longer read; thumbnails are encoded in the lossy lane (src/preparation/raster/lossy-lane.ts). Remove it from raster.json.');
    if (thumbnail.centerLongitudeDegrees !== undefined && !(typeof thumbnail.centerLongitudeDegrees === 'number' && Number.isFinite(thumbnail.centerLongitudeDegrees))) throw new TypeError('thumbnail.centerLongitudeDegrees must be a finite number.');
    if (thumbnail.crop !== undefined) {
        const crop = record(thumbnail.crop, 'thumbnail.crop');
        fields(crop, ['left', 'top', 'width', 'height'], 'thumbnail.crop');
    }
    // A body whose surfaces come from an observed-surfaces recipe states none here and takes only its lighting bank from
    // this lane. Every other recipe still states at least one; the composition check refuses a body that supplies neither.
    const observedSurfaces = Array.isArray(recipe.surfaces) && recipe.surfaces.length === 0 && recipe.lighting !== undefined;
    if (!observedSurfaces && (!Array.isArray(recipe.surfaces) || !recipe.surfaces.length))
        throw new TypeError('At least one source surface is required.');
    const ids = new Set<string>();
    for (const entry of (Array.isArray(recipe.surfaces) ? recipe.surfaces : [])) {
        const surface = record(entry, 'surface');
        text(surface.id, 'surface.id');
        if (ids.has(surface.id))
            throw new TypeError('Duplicate surface id.');
        ids.add(surface.id);
        for (const key of ['source', 'output', 'thumbnail'])
            path(surface[key], `surface.${key}`);
        if (typeof surface.falseColor !== 'boolean')
            throw new TypeError('falseColor must be boolean.');
        if (surface.thumbnailFromLimbPlate !== undefined && (surface.thumbnailFromLimbPlate !== true || recipe.emission === undefined ||
            record(surface.science, 'surface.science').kind !== 'stellar-photometric-color'))
            throw new TypeError('thumbnailFromLimbPlate requires an emissive stellar-photometric-color surface.');
        if (surface.resolutionScale !== undefined) {
            finite(surface.resolutionScale, 'surface.resolutionScale', true);
            const width = Number(recipe.width) * surface.resolutionScale;
            const height = Number(recipe.height) * surface.resolutionScale;
            if (![width, height, height / Number(recipe.latitudeBands) / 4].every(n => Number.isSafeInteger(n) && n > 0) || recipe.resample !== 'density-before-pack' || thumbnail.crop !== undefined || recipe.emission !== undefined)
                throw new TypeError('Surface resolution scaling needs integer density-before-pack output with separate poles and an uncropped thumbnail.');
        }
        if (surface.encoding !== undefined) {
            const encoding = record(surface.encoding, 'surface.encoding');
            if (Object.keys(encoding).some(key => !['format', 'encoder', 'progressive', 'quality', 'grayscale', 'chromaSubsampling'].includes(key)) || encoding.format !== 'jpeg' ||
                (encoding.encoder !== 'libjpeg' && encoding.encoder !== 'mozjpeg') || typeof encoding.progressive !== 'boolean')
                throw new TypeError('Unsupported surface encoding.');
            finite(encoding.quality, 'surface.encoding.quality', true);
            if (!Number.isInteger(encoding.quality) || encoding.quality > 100)
                throw new TypeError('surface.encoding.quality must be an integer from 1 to 100.');
            if (encoding.grayscale !== undefined && typeof encoding.grayscale !== 'boolean')
                throw new TypeError('surface.encoding.grayscale must be boolean.');
            if (encoding.chromaSubsampling !== undefined && encoding.chromaSubsampling !== '4:2:0' && encoding.chromaSubsampling !== '4:4:4')
                throw new TypeError('Unknown surface chroma subsampling.');
            if (encoding.grayscale === true && encoding.chromaSubsampling !== undefined)
                throw new TypeError('A grayscale surface has no chroma subsampling.');
        }
        const extension = surface.encoding === undefined ? '.webp' : '.jpg';
        if (!String(surface.output).endsWith(extension))
            throw new TypeError(`surface.output must end in ${extension} for its encoding.`);
        if (surface.exposure !== undefined)
            numbers(surface.exposure, 'surface.exposure', 3);
        if (surface.nativeSourcePoles !== undefined && surface.nativeSourcePoles !== true)
            throw new TypeError('surface.nativeSourcePoles must be true when declared.');
        if (surface.nativeSourcePoles && recipe.resample !== 'density-before-pack')
            throw new TypeError('Native source poles need density-before-pack storage.');
        if (surface.science !== undefined) {
            const science = record(surface.science, 'surface.science');
            if (recipe.resample === 'source-packed') throw new TypeError('surface.science needs density-before-pack resampling.');
            if (surface.coverage !== undefined || surface.sharpen !== undefined || surface.exposure !== undefined) throw new TypeError('surface.science replaces coverage, sharpen and exposure.');
            // Absent kind keeps the static-observation contract; other kinds are validated by their decoder owners in tools.
            if (science.kind !== undefined) text(science.kind, 'surface.science.kind');
            const validity = science.validity === undefined ? undefined : record(science.validity, 'surface.science.validity');
            if ((science.kind === 'terrestrial-observed-color' || science.kind === 'disc-integrated-band-color' || validity?.kind === 'pds4-float-rgb') && !surface.falseColor)
                throw new TypeError('Measured band composites must declare falseColor; display encoding does not establish natural color.');
        }
        if (surface.thumbnailCenterLongitudeDegrees !== undefined) {
            finite(surface.thumbnailCenterLongitudeDegrees, 'surface.thumbnailCenterLongitudeDegrees');
            if (recipe.resample !== 'density-before-pack')
                throw new TypeError('A per-lens thumbnail centre needs density-before-pack storage.');
        }
        if (surface.sharpen !== undefined)
            finite(surface.sharpen, 'surface.sharpen', true);
        if (surface.nativeSourcePoles && surface.sharpen !== undefined)
            throw new TypeError('Native source poles cannot reproduce a resized-map sharpen pass.');
        if (surface.coverage !== undefined) {
            const coverage = record(surface.coverage, 'coverage');
            path(coverage.normal, 'coverage.normal');
            path(coverage.topography, 'coverage.topography');
            if (!Array.isArray(coverage.references) || !coverage.references.length)
                throw new TypeError('Coverage source references missing.');
            coverage.references.forEach(item => text(item, 'coverage.reference'));
        }
    }
    if (recipe.lighting !== undefined) {
        const authored = record(recipe.lighting, 'lighting');
        // A recipe naming a shared bank states only its own fields; the bank's are filled in here (lighting-banks.ts).
        if (authored.bank !== undefined) text(authored.bank, 'lighting.bank');
        const lighting = authored.bank === undefined ? authored : resolveLightingRecipe(authored as unknown as LightingRecipe) as unknown as RecordValue;
        fields(lighting, ['frameSize', 'columns', 'presentationSize', 'billboardFrameSize', 'billboardColumns', 'frameCount', 'radiusScale'], 'lighting', true);
        fields(lighting, ['defaultFrame', 'minimumLightViewZ', 'maximumLightViewZ'], 'lighting');
        const authoredLaw = ['shadowlessFloodLimbFloor', 'ambientIntensity', 'terminator', 'maximumAlpha'].filter(key => lighting[key] !== undefined);
        if (lighting.limb !== undefined) {
            if (authoredLaw.length) throw new TypeError(`lighting names published models in lighting.limb, so it states no authored law; remove lighting.${authoredLaw.join(', lighting.')}.`);
            parseLimbBlock(lighting.limb, 'lighting.limb');
        }
        else {
            fields(lighting, ['maximumAlpha'], 'lighting', true);
            fields(lighting, ['shadowlessFloodLimbFloor', 'ambientIntensity'], 'lighting');
            numbers(lighting.terminator, 'lighting.terminator', 2);
        }
        for (const key of ['rowOutput', 'billboardOutput'])
            path(lighting[key], `lighting.${key}`);
        for (const key of ['bankSchema', 'billboardSchema'])
            text(lighting[key], `lighting.${key}`);
        record(lighting.metadata, 'lighting.metadata');
        recipe.lighting = lighting;
    }
    if (recipe.emission !== undefined) {
        const emission = record(recipe.emission, 'emission');
        for (const key of ['offLimbSize', 'limbSize', 'bodyDiameter']) finite(emission[key], `emission.${key}`, true);
        for (const key of ['offLimbOutput', 'limbOutput']) path(emission[key], `emission.${key}`);
        record(emission.metadata, 'emission.metadata');
        if (recipe.lighting !== undefined || recipe.atmosphere !== undefined) throw new TypeError('An emissive surface carries no lighting or atmosphere bank.');
    }
    if (recipe.atmosphere !== undefined) {
        const atmosphere = record(recipe.atmosphere, 'atmosphere');
        for (const key of ['materialOutput', 'observationOutput', 'lightingOutput'])
            path(atmosphere[key], `atmosphere.${key}`);
        fields(atmosphere, ['tileSize', 'logicalSize', 'bodyRadius', 'supersampling', 'coverageScale', 'contentScale', 'frameCount', 'directionalFrameCount', 'columns', 'rows'], 'atmosphere', true);
        fields(atmosphere, ['minimumLightViewZ', 'maximumLightViewZ'], 'atmosphere');
        if ((atmosphere.halo === undefined) !== (atmosphere.haloEdgeAltitudeKm === undefined))
            throw new TypeError(`atmosphere.halo and atmosphere.haloEdgeAltitudeKm come together; got halo ${JSON.stringify(atmosphere.halo)}, haloEdgeAltitudeKm ${JSON.stringify(atmosphere.haloEdgeAltitudeKm)}.`);
        if (atmosphere.halo !== undefined) { path(atmosphere.halo, 'atmosphere.halo'); fields(atmosphere, ['haloEdgeAltitudeKm'], 'atmosphere'); }
        parseLimbBlock(atmosphere.limb, 'atmosphere.limb');
        const retired = ['source', 'directionalShadowRelease', 'floodShadowRelease', 'sunwardShadowRelease', 'terminator'].filter(key => atmosphere[key] !== undefined);
        if (retired.length) throw new TypeError(`atmosphere takes its disc from atmosphere.limb and its halo from atmosphere.halo; remove the authored atmosphere.${retired.join(', atmosphere.')}.`);
    }
    if (recipe.interior !== undefined) {
        const interior = record(recipe.interior, 'interior');
        for (const key of ['source', 'surface', 'outerOutput', 'outerPolesOutput', 'outerUnlitOutput', 'outerUnlitPolesOutput', 'coreOutput', 'corePolesOutput', 'sectionOutput', 'thumbnail'])
            path(interior[key], `interior.${key}`);
        fields(interior, ['width', 'height', 'poleTile', 'sectionWidth', 'sectionHeight'], 'interior', true);
        fields(interior, ['ambientIntensity', 'coreNoiseSeed'], 'interior');
        numbers(interior.worldLightDirection, 'interior.worldLightDirection', 3);
        record(interior.metadata, 'interior.metadata');
    }
    // Downstream reads one list; a recipe that states no surface prepares only its lighting bank.
    return { ...recipe, surfaces: Array.isArray(recipe.surfaces) ? recipe.surfaces : [] } as unknown as RasterRecipe;
}
