import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/caliban/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'caliban',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/caliban/caliban-directional-sun.webp',two:'/scenes/caliban/caliban-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/caliban/caliban-model-surface@2x.webp','/scenes/caliban/caliban-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
