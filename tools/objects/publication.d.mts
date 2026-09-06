import type { RuntimeManifest } from './operations.js';
export function readPreparedJsonOutputs(directory: string): Promise<{filename: string; path: string}[]>;
export function publishPreparedAssets(context: { id: string; stage: string; destination: string; previous: RuntimeManifest | null; manifest: RuntimeManifest; recovery: string }): Promise<{published:number;retired:string[];recovery:string}>;
