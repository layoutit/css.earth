import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/oumuamua/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'oumuamua',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/oumuamua/oumuamua-model-surface@2x.webp','/scenes/oumuamua/oumuamua-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
