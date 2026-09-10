import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/himalia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'himalia',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/himalia/himalia-directional-sun.webp',two:'/scenes/himalia/himalia-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/himalia/himalia-model-surface@2x.webp','/scenes/himalia/himalia-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
