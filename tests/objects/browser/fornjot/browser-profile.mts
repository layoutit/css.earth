import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/fornjot/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'fornjot',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/fornjot/fornjot-directional-sun.webp',two:'/scenes/fornjot/fornjot-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/fornjot/fornjot-model-surface@2x.webp','/scenes/fornjot/fornjot-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
