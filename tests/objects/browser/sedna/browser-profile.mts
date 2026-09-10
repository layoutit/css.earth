import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/sedna/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sedna',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/sedna/sedna-directional-sun.webp',two:'/scenes/sedna/sedna-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/sedna/sedna-model-surface@2x.webp','/scenes/sedna/sedna-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
