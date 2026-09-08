import type { RuntimeManifest } from './operations.js';
export function readPreparedJsonOutputs(directory: string): Promise<{filename: string; path: string}[]>;
export function publishPreparedMinimaps(context: { stage: string; destination: string; recovery: string }): Promise<void>;
export function publishPreparedAssets(context: { id: string; stage: string; destination: string; previous: RuntimeManifest | null; manifest: RuntimeManifest; recovery: string }): Promise<{published:number;retired:string[];recovery:string}>;
