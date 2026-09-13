import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/eurybates/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eurybates',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/eurybates/eurybates-directional-sun.webp',two:'/scenes/eurybates/eurybates-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/eurybates/eurybates-model-surface@2x.webp','/scenes/eurybates/eurybates-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
