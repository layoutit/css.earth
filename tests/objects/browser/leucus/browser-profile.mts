import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/leucus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'leucus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/leucus/leucus-model-surface@2x.webp','/scenes/leucus/leucus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
