import { resolve } from 'node:path';
import { projectRoot } from '../../fixtures.mjs';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mjs';
const source=await createSourceManifest({planetId:'moon',planetName:'Moon',sourceRoot:resolve(projectRoot,'src/planets/moon/source')});
export const verifyMoonSourceManifest=()=>source.verify();
