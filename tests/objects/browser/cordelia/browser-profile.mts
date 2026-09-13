import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/cordelia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cordelia',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/cordelia/cordelia-model-surface@2x.webp','/scenes/cordelia/cordelia-lighting.webp','/scenes/cordelia/cordelia-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
