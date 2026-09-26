import type { SourceInput, SourceEntry, SourceManifest } from '@cssearth/objects/node';
import type { RadialSurface, SurfaceConfig } from '@cssearth/bake/objects/layers/terrestrial';
export interface SourceAccess {manifest?:SourceManifest;validateGroup(consumer:string):Promise<readonly SourceInput[]>;validatePath(path:string):Promise<SourceEntry>}
export interface SurfaceOptions {sourceDirectory:string;source:SourceAccess;recipe:unknown;radial:RadialSurface;config:SurfaceConfig}
