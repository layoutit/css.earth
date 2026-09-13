import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/gonggong/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gonggong',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/gonggong/gonggong-directional-sun.webp',two:'/scenes/gonggong/gonggong-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/gonggong/gonggong-model-surface@2x.webp','/scenes/gonggong/gonggong-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
