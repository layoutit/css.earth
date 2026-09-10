import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/cressida/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cressida',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/cressida/cressida-directional-sun.webp',two:'/scenes/cressida/cressida-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/cressida/cressida-model-surface@2x.webp','/scenes/cressida/cressida-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
