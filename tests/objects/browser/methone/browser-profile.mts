import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/methone/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'methone',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/methone/methone-normal-surface@2x.webp','/scenes/methone/methone-lighting.webp','/scenes/methone/methone-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
