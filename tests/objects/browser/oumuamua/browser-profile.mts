import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/oumuamua/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'oumuamua',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/oumuamua/oumuamua-model-surface@2x.webp','/scenes/oumuamua/oumuamua-lighting.webp','/scenes/oumuamua/oumuamua-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
