import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/chiron/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'chiron',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/chiron/chiron-model-surface@2x.webp','/scenes/chiron/chiron-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
