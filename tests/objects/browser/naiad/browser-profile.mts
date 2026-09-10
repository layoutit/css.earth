import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/naiad/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'naiad',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/naiad/naiad-directional-sun.webp',two:'/scenes/naiad/naiad-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/naiad/naiad-model-surface@2x.webp','/scenes/naiad/naiad-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
