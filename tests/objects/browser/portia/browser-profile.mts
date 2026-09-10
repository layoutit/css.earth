import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/portia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'portia',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/portia/portia-directional-sun.webp',two:'/scenes/portia/portia-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/portia/portia-model-surface@2x.webp','/scenes/portia/portia-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
