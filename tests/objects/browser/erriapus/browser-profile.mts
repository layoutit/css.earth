import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/erriapus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'erriapus',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/erriapus/erriapus-directional-sun.webp',two:'/scenes/erriapus/erriapus-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/erriapus/erriapus-model-surface@2x.webp','/scenes/erriapus/erriapus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
