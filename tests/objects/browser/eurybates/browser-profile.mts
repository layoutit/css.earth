import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/eurybates/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eurybates',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/eurybates/eurybates-model-surface@2x.webp','/scenes/eurybates/eurybates-lighting.webp','/scenes/eurybates/eurybates-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
