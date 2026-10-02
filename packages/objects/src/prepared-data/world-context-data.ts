import { PREPARED_WORLD_CONTEXT_SCHEMA } from './world-schemas.js';
import type { PreparedWorldCameraFrame, WorldPosition as Vector3 } from './world-frame.js';
import type { PreparedContextFocus, PreparedWorldContext } from './world-context.js';
import type { PreparedOrbitCenter } from './prepared-orbit-centers.js';
import type { PreparedSystemView } from './world-system-view.js';

export interface PreparedWorldContextData {
  readonly schema: typeof PREPARED_WORLD_CONTEXT_SCHEMA;
  readonly orbitCenters?: Readonly<Record<string, PreparedOrbitCenter>>;
  readonly sky: { readonly sceneRegistration: string };
  readonly frame: PreparedWorldCameraFrame;
  readonly focus: Omit<PreparedContextFocus, 'systemView'> & { readonly systemView?: PreparedSystemView };
  /** Each classification framed by its members' prepared positions, keyed by classification. */
  readonly classificationViews?: Readonly<Record<string, PreparedSystemView>>;
  readonly bodies: readonly { readonly id: string; readonly name: string; readonly color: string; readonly positionM: Vector3; readonly radiusM: number;
    readonly systemView?: PreparedSystemView;
    readonly placement?: 'approximate';
    readonly unpackaged?: true;
    readonly orbitsWithinM?: number;
    /** Caption the body over its middle instead of below it. */
    readonly labelPlacement?: 'centre';
    readonly contextColor?: string;
    readonly labelCase?: 'upper';
    readonly classification?: string;
    readonly systemName?: string;
    readonly discovery?: Readonly<Record<string, unknown>>;
    readonly plainDot?: true;
    readonly dotColor?: string;
    /** A placed star bound to another with no measured orbit: its host and the pair's centre of mass. */
    readonly boundTo?: { readonly hostId: string; readonly centerM: Vector3 };
    /** Absent for a placed body, which has a position but no orbit to draw. */
    readonly orbit?: { readonly centerBodyId: string; readonly centerPositionM: Vector3; readonly verticesM: readonly Vector3[]; readonly trail: readonly number[];
      readonly bounds: { readonly centerM: Vector3; readonly radiusM: number }; readonly activeChords: readonly number[];
      readonly extentChords: readonly number[]; readonly lod: PreparedOrbitDataLod;
      /** Open trajectories carry N-1 chords, an explicit epoch vertex and a finite display window. */
      readonly closed?: false; readonly bodyVertexIndex?: number; readonly displayExtentAu?: number;
      readonly trailModel?: 'finite-open-trajectory-constant-weight' } }[];
  readonly camera: PreparedWorldContext['camera'];
  readonly system: PreparedWorldContext['system'];
  readonly volume: PreparedWorldContext['volume'];
  readonly stars: PreparedWorldContext['stars'];
}
export interface PreparedOrbitDataLodLevel {
  readonly vertexIndices: readonly number[]; readonly trail: readonly number[];
  readonly activeChords: readonly number[]; readonly deviationM: number;
}
export interface PreparedOrbitDataLod {
  readonly bounds: { readonly centerM: Vector3; readonly radiusM: number };
  readonly levels: readonly PreparedOrbitDataLodLevel[];
}

