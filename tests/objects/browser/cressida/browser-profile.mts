import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/cressida/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cressida',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/cressida/cressida-model-surface@2x.webp','/scenes/cressida/cressida-lighting.webp','/scenes/cressida/cressida-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
