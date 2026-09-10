import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/quaoar/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'quaoar',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/quaoar/quaoar-directional-sun.webp',two:'/scenes/quaoar/quaoar-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/quaoar/quaoar-model-surface@2x.webp','/scenes/quaoar/quaoar-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
