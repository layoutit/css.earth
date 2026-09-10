import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/varuna/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'varuna',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/varuna/varuna-directional-sun.webp',two:'/scenes/varuna/varuna-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/varuna/varuna-model-surface@2x.webp','/scenes/varuna/varuna-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
