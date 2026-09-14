import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/ymir/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ymir',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/ymir/ymir-model-surface@2x.webp','/scenes/ymir/ymir-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
