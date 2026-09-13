import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/gkunhomdima/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gkunhomdima',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/gkunhomdima/gkunhomdima-directional-sun.webp',two:'/scenes/gkunhomdima/gkunhomdima-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/gkunhomdima/gkunhomdima-model-surface@2x.webp','/scenes/gkunhomdima/gkunhomdima-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
