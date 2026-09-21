import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/neso/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'neso',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/neso/neso-model-surface@2x.webp','/scenes/neso/neso-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
