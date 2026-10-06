export interface PreparedMaterialFrameMapping { thresholds: readonly number[]; indices: readonly number[]; }

export interface PreparedMaterialAddress { resource: string | null; backgroundPosition: string; backgroundSize: string; frame: number | null; row: number | null; prewarm?: readonly string[]; }

export interface PreparedMaterialBank { id: string; default?: PreparedMaterialAddress | null; fixed?: PreparedMaterialAddress | null; frames: readonly PreparedMaterialAddress[]; }

export interface PreparedMaterialRotationPolicy { reference: "initial" | "prepared"; baseDegrees: number; polePolicy?: "azimuth" | "preserve"; zeroAtPole?: boolean; onlyWhenEnabled?: boolean; publishWithAddress?: boolean;
  physical?: { projection: EllipsoidProjectionPlan; width: number; height?: number } & {systemTransform:string}; }

export type PreparedMaterialRotation = PreparedMaterialRotationPolicy & (
  /** The light's roll about the view axis: the page writes `transform: rotate(<angle>deg)` on the track's target. */
  { kind: "angle" } |
  { kind: "planar"; width: number; height?: number } |
  ({ kind: "ellipsoid"; systemTransform: string } & { projection: EllipsoidProjectionPlan; width: number; height?: number })
);

export interface PreparedMaterialTrack {
  id: string; target: number; frame: PreparedMaterialFrameMapping; defaultFrame: number;
  banks: readonly PreparedMaterialBank[]; rotation?: PreparedMaterialRotation | null; quoted?: boolean; frameAttribute?: string | null; modeAttribute?: string | null;
}

export interface PreparedMaterialSelection {
  track: string; bank: string; mode: "fixed" | "frames"; fixedMode: string; frameOverride?: number | null; frameOffset?: number;
  enabled: boolean; rotationEnabled: boolean; modeLabel?: string; publishWhenHidden?: "always" | "static" | "never"; clearWhenHidden?: boolean;
  addressAttributes?: readonly { source: "frame" | "mode" | "mode-or-frame" | "literal"; name: string; value: string | null }[];
}

export interface CounterTransport { counterPrecision?:number;counterFractionDigits?:number;counterFractionScale?:number; }

export interface EllipsoidProjectionPlan extends CounterTransport {equatorialRadius:number;polarRadius:number;coverageScale:number;bodySystemMatrix:readonly number[];bodyMeshMatrix:readonly number[];materialSystemMatrix:readonly number[];materialMeshMatrix:readonly number[];baseProjection:readonly number[];centerTranslation:readonly number[];inverseCenterTranslation:readonly number[];textureEllipse?:{center:readonly[number,number];covariance:readonly[number,number,number]};}
