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
    sharpen?: number[];
    exposure?: number[];
    coverage?: {
        normal: string;
        topography: string;
        references: string[];
    };
}
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
export interface RasterRecipe {
    schema: 'cssearth-raster-recipe@1';
    publicBase: string;
    sourceWidth: number;
    sourceHeight: number;
    width: number;
    height: number;
    latitudeBands: number;
    polarTile: number;
    densities: number[];
    resample: 'source-packed' | 'density-before-pack';
    polarProjection: 'angular-nearest' | 'orthographic-bilinear';
    surfaces: SurfaceRasterRecipe[];
    polesOutput: string;
    polesCombined: boolean;
    surfaceMetadata: {
        schema: string;
        sourcePositionVariable?: string;
    };
    thumbnail: {
        size: number;
        crop?: {
            left: number;
            top: number;
            width: number;
            height: number;
        };
        quality: number;
    };
    lighting?: LightingRecipe;
    atmosphere?: AtmosphereRecipe;
    interior?: InteriorRecipe;
}
