import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/thrymr/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thrymr',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/thrymr/thrymr-directional-sun.webp',two:'/scenes/thrymr/thrymr-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/thrymr/thrymr-model-surface@2x.webp','/scenes/thrymr/thrymr-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
