import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/okyrhoe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'okyrhoe',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/okyrhoe/okyrhoe-model-surface@2x.webp','/scenes/okyrhoe/okyrhoe-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
