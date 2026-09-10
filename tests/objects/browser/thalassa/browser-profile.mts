import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/thalassa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thalassa',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/thalassa/thalassa-directional-sun.webp',two:'/scenes/thalassa/thalassa-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/thalassa/thalassa-model-surface@2x.webp','/scenes/thalassa/thalassa-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
