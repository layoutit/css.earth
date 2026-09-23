import type { AtmosphericRasterConfig, LambertRasterConfig, CutawayAngles, InteriorPalette } from '@cssearth/objects';
/** Delivered surface map encoding. Absent means the lossy WebP default. */
export interface SurfaceEncoding {
    format: 'jpeg';
    /** libjpeg: sharp's libjpeg-compatible defaults; mozjpeg: its trellis preset. */
    encoder: 'libjpeg' | 'mozjpeg';
    progressive: boolean;
    quality: number;
    grayscale?: boolean;
    chromaSubsampling?: '4:2:0' | '4:4:4';
}
export interface SurfaceRasterRecipe {
    id: string;
    source: string;
    falseColor: boolean;
    output: string;
    encoding?: SurfaceEncoding;
    thumbnail: string;
    /** For an unresolved star, make the picker thumbnail from its prepared camera-facing limb plate. */
    thumbnailFromLimbPlate?: boolean;
    /** Offline surface resolution relative to the shared layout; does not change geometry or lighting. */
    resolutionScale?: number;
    sharpen?: number;
    exposure?: number[];
    /** Opt in to sampling the pinned source image directly for pole sprites. The delivered latitude bands stay unchanged. */
    nativeSourcePoles?: boolean;
    /** Centre of this lens's picker thumbnail, overriding the recipe's and in the same frame: degrees east of the
     * map's left edge, not of the prime meridian. A lens that observed one hemisphere would otherwise crop its
     * thumbnail out of the data gap and offer the reader a blank tile. */
    thumbnailCenterLongitudeDegrees?: number;
    coverage?: {
        normal: string;
        topography: string;
        references: string[];
    };
    /** Scientific interpretation before packing (numeric grids, colour ramps, categorical palettes, tonal presentation,
     * missing-coverage grid): the static lane's observation fields, applied by an injected adapter. */
    science?: Record<string, unknown>;
}
/** An unlit body: per-lens off-limb context and limb plates written by the interpretation instead of a lighting bank. */
export interface EmissionRecipe { offLimbSize: number; limbSize: number; bodyDiameter: number; offLimbOutput: string; limbOutput: string; metadata: Record<string, unknown>; }
export interface LightingRecipe extends LambertRasterConfig {
    frameSize: number;
    columns: number;
    presentationSize: number;
    defaultFrame: number;
    billboardFrameSize: number;
    billboardColumns: number;
    rowOutput: string;
    billboardOutput: string;
    metadata: Record<string, unknown>;
    bankSchema: string;
    billboardSchema: string;
}
export interface AtmosphereRecipe extends AtmosphericRasterConfig {
    source: string;
    tileSize: number;
    frameCount: number;
    directionalFrameCount: number;
    columns: number;
    rows: number;
    minimumLightViewZ: number;
    maximumLightViewZ: number;
    directionalShadowRelease: number;
    floodShadowRelease: number;
    materialOutput: string;
    observationOutput: string;
    lightingOutput: string;
}
export interface InteriorRecipe {
    source: string;
    surface: string;
    worldLightDirection: number[];
    ambientIntensity: number;
    coreNoiseSeed: number;
    width: number;
    height: number;
    poleTile: number;
    sectionWidth: number;
    sectionHeight: number;
    outerOutput: string;
    outerPolesOutput: string;
    outerUnlitOutput: string;
    outerUnlitPolesOutput: string;
    coreOutput: string;
    corePolesOutput: string;
    sectionOutput: string;
    thumbnail: string;
    metadata: Record<string, unknown>;
}
export interface StructureSource {
    metallicCoreRadiusFraction: number;
    metallicCoreRadiusKm: number;
    planetRadiusKm: number;
    outerShellThicknessKm: number;
    publishedApproximateOuterShellThicknessKm: number;
    structureQualification: string;
    presentation: {
        model: string;
        palette: InteriorPalette;
        cutaway: CutawayAngles;
        qualification: string;
        lighting: {
            model: string;
            worldLightDirection: number[];
        };
    };
}
/** Every raster-lane image is prepared once, at the canonical density; there is no 1x output. */
export { CANONICAL_PREPARED_IMAGE_DENSITY as RASTER_DENSITY } from '../../renderers/css/rendering/prepared-object-assets.js';
export interface RasterRecipe {
    schema: 'cssearth-raster-recipe@1';
    publicBase: string;
    sourceWidth: number;
    sourceHeight: number;
    width: number;
    height: number;
    latitudeBands: number;
    polarTile: number;
    resample: 'source-packed' | 'density-before-pack';
    /** Source-packed maps normally pack first, then resize. This opt-in resizes the accepted source map before
     * packing so the resampler never reads across stored latitude-strip gutters. */
    unpackedResizeBeforePack?: boolean;
    polarProjection: 'angular-nearest' | 'orthographic-bilinear';
    /** How a data gap is filled. The shared cartographic grey is the default; `dark` keeps the same graticule on black,
     * for a body whose observed side is a self-luminous image rather than a lit map. */
    missingCoverage?: 'gray' | 'dark';
    surfaces: SurfaceRasterRecipe[];
    polesOutput: string;
    polesCombined: boolean;
    surfaceMetadata: {
        schema: string;
        sourcePositionVariable?: string;
    };
    thumbnail: {
        size: number;
        /** Longitude at the centre of the square thumbnail crop (default 180: the map centre); the crop wraps across the map edge. */
        centerLongitudeDegrees?: number;
        crop?: {
            left: number;
            top: number;
            width: number;
            height: number;
        };
        quality: number;
    };
    lighting?: LightingRecipe;
    emission?: EmissionRecipe;
    atmosphere?: AtmosphereRecipe;
    interior?: InteriorRecipe;
}
