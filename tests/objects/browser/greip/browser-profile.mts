import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/greip/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'greip',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/greip/greip-model-surface@2x.webp','/scenes/greip/greip-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
