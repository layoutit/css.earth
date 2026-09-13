import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/tarqeq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tarqeq',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/tarqeq/tarqeq-directional-sun.webp',two:'/scenes/tarqeq/tarqeq-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/tarqeq/tarqeq-model-surface@2x.webp','/scenes/tarqeq/tarqeq-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
