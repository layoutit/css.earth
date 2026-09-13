import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/bienor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bienor',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/bienor/bienor-directional-sun.webp',two:'/scenes/bienor/bienor-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/bienor/bienor-model-surface@2x.webp','/scenes/bienor/bienor-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
