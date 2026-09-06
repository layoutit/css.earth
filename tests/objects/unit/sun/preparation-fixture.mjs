import { resolve } from 'node:path';
import { projectRoot } from '../../fixtures.mjs';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mjs';
import { verifyStaticSurfaceReproduction } from '../../../../tools/objects/static-surface/reproduction.mjs';
export const verifySunRasterReproduction = () => verifyStaticSurfaceReproduction({ id: 'sun', projectRoot });
const source=await createSourceManifest({planetId:'sun',planetName:'Sun',sourceRoot:resolve(projectRoot,'src/planets/sun/source')});
export const verifySunSourceManifest=()=>source.verify();
