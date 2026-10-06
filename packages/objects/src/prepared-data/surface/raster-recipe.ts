import type { LimbBlock } from '../photometry/limb-block.js';
export const RASTER_RECIPE_SCHEMA = 'cssearth-raster-recipe@2';
export interface CutawayAngles {
    centerLongitudeDegrees: number;
    widthDegrees: number;
}
export interface InteriorPalette {
    metallicCore: readonly number[];
    combinedMantleCrust: readonly number[];
    layerContact: readonly number[];
}
/** The authored sphere law of a shared lighting bank: a flood-lit limb floor, an ambient term, a terminator ramp and the
 * darkest overlay alpha. It has no published source; a body with one names `lighting.limb` instead. */
export interface AuthoredSphereLaw {
    shadowlessFloodLimbFloor: number;
    ambientIntensity: number;
    terminator: readonly number[];
    maximumAlpha: number;
}
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
    /** Centre of this dataset's picker thumbnail, overriding the recipe's and in the same frame: degrees east of the
     * map's left edge, not of the prime meridian. A dataset that observed one hemisphere would otherwise crop its
     * thumbnail out of the data gap and offer the reader a blank tile. */
    thumbnailCenterLongitudeDegrees?: number;
    coverage?: {
        normal: string;
        topography: string;
        references: string[];
    };
    /** Scientific interpretation before packing (numeric grids, color ramps, categorical palettes, tonal presentation,
     * missing-coverage grid): the static lane's observation fields, applied by an injected adapter. */
    science?: Record<string, unknown>;
    /** Draw this science dataset over an earlier surface: every cell its interpretation leaves empty takes that surface's
     * pixel scaled by `brightness`, so ground with no catalogued feature shows terrain instead of the missing-data grid.
     * The scale is a presentation choice the dataset states in its notes. `grayscale` draws the terrain as Rec. 709 luma and
     * `bits` keeps that many high bits per channel: the underlay is context, so it may cost fewer lossless bytes. */
    underlay?: { surface: string; brightness: number; grayscale?: boolean; bits?: number };
}
/** An unlit body: per-dataset off-limb context and limb plates written by the interpretation instead of a lighting bank. */
export interface EmissionRecipe { offLimbSize: number; limbSize: number; bodyDiameter: number; offLimbOutput: string; limbOutput: string; metadata: Record<string, unknown>; }
/**
 * A sphere's lighting: the frames of one sheet and the flood-lit frame beside it (packages/bake/src/raster/lighting-sheet.ts
 * owns their count, size and file names). A recipe names a shared bank, whose authored law the parser fills in, or the
 * body's published photometric models; never both.
 */
export interface LightingRecipe extends Partial<AuthoredSphereLaw> {
    /** A shared bank (lighting-banks.ts) whose authored law this recipe takes. */
    bank?: string;
    /** The body's published photometric models (packages/bake/src/photometry/limb.ts). */
    limb?: LimbBlock;
    /** The overlay's width in CSS pixels: the body's logical diameter. */
    presentationSize: number;
    /** Notes the prepared lighting record carries, such as the law a published model is. */
    metadata?: Record<string, unknown>;
}
/**
 * A body with an atmosphere: its disc lit by its published photometric models and, when the body has one, a halo read
 * from one NASA PSG limb profile (packages/bake/src/photometry/halo.ts). Frames only evaluate both.
 */
export interface AtmosphereRecipe {
    limb: LimbBlock;
    /** Source-relative PSG limb profile: radiance by tangent altitude at full phase (packages/bake/src/photometry/halo.ts). Absent: the disc alone. */
    halo?: string;
    /** Altitude of the disc's visible edge above the table's reference radius, in km (0 for a surface); given with `halo`. */
    haloEdgeAltitudeKm?: number;
    logicalSize: number;
    bodyRadius: number;
    supersampling: number;
    coverageScale: number;
    contentScale: number;
    tileSize: number;
    frameCount: number;
    directionalFrameCount: number;
    columns: number;
    rows: number;
    minimumLightViewZ: number;
    maximumLightViewZ: number;
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

export interface RasterRecipe {
    schema: typeof RASTER_RECIPE_SCHEMA;
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
    surfaceMetadata: {
        schema: string;
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
    };
    lighting?: LightingRecipe;
    emission?: EmissionRecipe;
    atmosphere?: AtmosphereRecipe;
    interior?: InteriorRecipe;
}
