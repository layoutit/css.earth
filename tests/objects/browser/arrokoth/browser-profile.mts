import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/arrokoth/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'arrokoth',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/arrokoth/arrokoth-directional-sun.webp',two:'/scenes/arrokoth/arrokoth-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/arrokoth/arrokoth-albedo-surface@2x.webp','/scenes/arrokoth/arrokoth-lighting.webp'],
  lensRace:{defaultId:'albedo',slowId:'model',winnerId:'albedo',slowAsset:'/scenes/arrokoth/arrokoth-model-surface@2x.webp',preReadyDisabled:true},
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
