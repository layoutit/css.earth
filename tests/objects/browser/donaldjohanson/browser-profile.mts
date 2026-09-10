import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/donaldjohanson/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'donaldjohanson',controls,audit:{
 preparedAssetPairs:[{one:'/scenes/donaldjohanson/donaldjohanson-directional-sun.webp',two:'/scenes/donaldjohanson/donaldjohanson-directional-sun@2x.webp'}],
 canonicalPreparedAssets:['/scenes/donaldjohanson/donaldjohanson-llorri-surface@2x.webp'],
 lensRace:{defaultId:'llorri',slowId:'shape',winnerId:'llorri',slowAsset:'/scenes/donaldjohanson/donaldjohanson-shape-surface@2x.webp',preReadyDisabled:true},
 retained:{lensIds:['llorri','shape'],speedClicks:5,allowedMountSelectors:[]}
}});
