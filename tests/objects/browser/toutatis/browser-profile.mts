import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/toutatis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'toutatis',controls,audit:{
 preparedAssetPairs:[{one:'/scenes/toutatis/toutatis-directional-sun.webp',two:'/scenes/toutatis/toutatis-directional-sun@2x.webp'}],
 canonicalPreparedAssets:['/scenes/toutatis/toutatis-shape-surface@2x.webp'],
 retained:{lensIds:['shape'],speedClicks:5,allowedMountSelectors:[]}
}});
