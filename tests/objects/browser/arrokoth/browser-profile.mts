import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/arrokoth/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'arrokoth',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/arrokoth/arrokoth-lorri-surface@2x.webp','/scenes/arrokoth/arrokoth-lighting.webp'],
  lensRace:{defaultId:'lorri',slowId:'mvic',winnerId:'albedo',slowAsset:'/scenes/arrokoth/arrokoth-mvic-surface@2x.webp',preReadyDisabled:true},
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
