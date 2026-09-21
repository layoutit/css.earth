import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/sao/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sao',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/sao/sao-model-surface@2x.webp','/scenes/sao/sao-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
