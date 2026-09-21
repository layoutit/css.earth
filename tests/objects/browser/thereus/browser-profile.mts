import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/thereus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thereus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/thereus/thereus-model-surface@2x.webp','/scenes/thereus/thereus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
