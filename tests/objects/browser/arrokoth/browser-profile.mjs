import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/arrokoth/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'arrokoth',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/arrokoth/arrokoth-directional-sun.webp',two:'/scenes/arrokoth/arrokoth-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/arrokoth/arrokoth-model-surface@2x.webp','/scenes/arrokoth/arrokoth-lighting.webp'],
  lensRace:{defaultId:'model',slowId:'albedo',winnerId:'model',slowAsset:'/scenes/arrokoth/arrokoth-albedo-surface@2x.webp',preReadyDisabled:true},
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
