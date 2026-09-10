import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/bertha/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bertha',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/bertha/bertha-directional-sun.webp",
      "two": "/scenes/bertha/bertha-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/bertha/bertha-shape-surface@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/bertha/bertha-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
