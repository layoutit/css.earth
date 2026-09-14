import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/albiorix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'albiorix',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/albiorix/albiorix-model-surface@2x.webp','/scenes/albiorix/albiorix-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
