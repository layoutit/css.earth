/** Geographic preparation contracts. The browser consumes finished page records. */
export interface PageAddress { level: number; x: number; y: number }
export interface TileAddress { zoom: number; x: number; y: number }
export interface GeographicBounds { west: number; east: number; south: number; north: number; projection?: undefined }
export interface PolarBounds { projection: 'polar'; hemisphere: 'north' | 'south'; u0: number; u1: number; v0: number; v1: number }
export interface GeographicLeaf { style: string; geographicFrameMatrix?: string; leafWidth: number }
export interface GeographicBody { bands: readonly { latitudeIndex: number; leaves: readonly GeographicLeaf[] }[] }
/** Row-major CSS rotation of the drawn body's system and mesh nodes: object (mesh-local) coordinates to presentation. */
export interface BodyAttitude { bodyMatrix: readonly number[] }
export interface GeographicScene { body: GeographicBody; [key: string]: unknown }
export interface PolarPlane { origin: number[]; basisU: number[]; basisV: number[]; qx: number; qy: number; inverse: number[]; west: number }
export interface PolarProjection { type: 'polar'; sign: number; side: number; x0: number; x1: number; y0: number; y1: number; matrix: number[]; planes: PolarPlane[] }
export interface PageGeometry extends PageAddress { key: string; width: number; height: number; corners: number[][]; normal: number[];
  frameMatrix: string; textureMatrix: string; bounds: GeographicBounds | PolarBounds; outer: GeographicBounds | PolarBounds;
  sourceBounds: GeographicBounds; geographicMatrix?: number[]; geographicProjection?: PolarProjection }
export interface PageTexture { frameMatrix: string; textureMatrix: string; corners: number[][] }
export interface WmtsPage extends PageAddress, PageTexture { key: string; rasterSource: string; url: string; width: number; height: number;
  bounds: GeographicBounds; sourceCrop: { u0: number; u1: number; v0: number; v1: number }; coarseKey: string;
  faceClip: { u0: number; u1: number; v0: number; v1: number }; normal: number[]; imageMatrix: string;
  textureBackgroundSize: string; textureBackgroundPosition: string; maximumCssSpan: number; children: string[]; projectionErrorPixels: number }
export interface CoverageBand { y0: number; y1: number; ranges: [number, number][] }
export interface WmtsCoverage { zoom: number; firstRow: number; lastRow: number; tileCount: number; blockSide: number; blockCount: number; bands: CoverageBand[] }
export interface WorldCoverEntry { tile: string; etag: string; sourceBytes: number; lastModified?: string; extractedSha256?: string }
export interface WorldCoverSource extends WorldCoverEntry { url: string }
export interface AssetReference { url: string; bytes: number; sha256: string }
export interface BlockReference extends AssetReference { encoding: string; offset: number; decodedBytes: number; decodedSha256: string }
export interface TileNode { key: string; level: number; corners: number[][]; normal: number[]; normalSlack: number; pages: string[]; children: string[]; maximumCssSpan: number }
export interface TileStub extends Omit<TileNode, 'pages' | 'children'> { stub: boolean; directory: BlockReference }
export interface TreeSection { bytes: Uint8Array; root: TileNode; tiles: number; leaves: number; ref: Omit<BlockReference, 'url' | 'offset'> }
export interface CameraPolicy { maximumControlPitchDegrees: number; maximumScenePitchDegrees: number }
export interface PreparedCityPage extends PageGeometry { children: string[]; coverageCorners?: number[][]; childrenCoverImage?: boolean }
export interface CorePage extends PageGeometry { corePath: string; children?: string[]; coverageCorners?: number[][]; childrenCoverImage?: boolean }
export interface CityRuntimePage extends Omit<PreparedCityPage, 'geographicMatrix' | 'geographicProjection'> { url: string; bytes: number; sha256: string; maximumCssSpan: number }
export interface CityIndexNode extends Partial<CityRuntimePage> { key: string; level: number; x: number; y: number; corners: number[][]; normal: number[]; children: string[] }
export interface CityIndexHead { key: string; level: number; corners: number[][]; normal: number[]; stub: boolean; directory: AssetReference; coverageCorners?: number[][] }
export interface CityCoveragePlan { dataset: string; assetPath?: string; assetOrigin: string; roots: CityIndexHead[] }
export interface CitySourceWindow { grid: number[]; width: number; height: number; pixels: number }
export interface CityCoverageJob { id: string; root: PageAddress; bounds: GeographicBounds; window: CitySourceWindow; lastLevel: number; sources: WorldCoverSource[]; unavailableTiles: string[]; blocked: string | null }
