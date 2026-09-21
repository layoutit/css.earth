import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/pelion/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pelion',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/pelion/pelion-model-surface@2x.webp','/scenes/pelion/pelion-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
