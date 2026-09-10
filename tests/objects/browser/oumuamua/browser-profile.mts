import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/oumuamua/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'oumuamua',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/oumuamua/oumuamua-directional-sun.webp',two:'/scenes/oumuamua/oumuamua-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/oumuamua/oumuamua-model-surface@2x.webp','/scenes/oumuamua/oumuamua-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
