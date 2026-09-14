import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/tarvos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tarvos',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/tarvos/tarvos-model-surface@2x.webp','/scenes/tarvos/tarvos-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
