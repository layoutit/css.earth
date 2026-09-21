import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/hylonome/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hylonome',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/hylonome/hylonome-model-surface@2x.webp','/scenes/hylonome/hylonome-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
