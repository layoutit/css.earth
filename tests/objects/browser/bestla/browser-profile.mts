import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/bestla/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bestla',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/bestla/bestla-model-surface@2x.webp','/scenes/bestla/bestla-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
