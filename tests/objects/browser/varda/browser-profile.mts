import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/varda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'varda',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/varda/varda-directional-sun.webp',two:'/scenes/varda/varda-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/varda/varda-model-surface@2x.webp','/scenes/varda/varda-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
