/// <reference path="./cesium-module-types.d.ts" />
import 'vite/client';

import type { publishObjectDiagnostics } from '@cssearth/renderer/runtime/object-diagnostics.ts';
export type ObjectRuntimeDiagnostics = ReturnType<typeof publishObjectDiagnostics>;
import type { SceneDiagnostics } from './scene/scene-router.mts';
import type { WorldContextDiagnostics } from './application-world-context.mts';
import type { createDiagnosticRecorder } from './diagnostic-recorder.mts';

// Development publishers install these only while their owning scene is mounted.
declare global {
  interface Window {
    __cssEarth?: SceneDiagnostics;
    __cssEarthUniverse?: WorldContextDiagnostics;
    __cssEarthRecorder?: ReturnType<typeof createDiagnosticRecorder>;
    __sun?: ObjectRuntimeDiagnostics;
    __mercury?: ObjectRuntimeDiagnostics;
    __venus?: ObjectRuntimeDiagnostics;
    __earth?: ObjectRuntimeDiagnostics;
    __moon?: ObjectRuntimeDiagnostics;
    __mars?: ObjectRuntimeDiagnostics;
    __jupiter?: ObjectRuntimeDiagnostics;
    __saturn?: ObjectRuntimeDiagnostics;
    __uranus?: ObjectRuntimeDiagnostics;
    __neptune?: ObjectRuntimeDiagnostics;
    __ceres?: ObjectRuntimeDiagnostics;
    __pluto?: ObjectRuntimeDiagnostics;
  }
}
