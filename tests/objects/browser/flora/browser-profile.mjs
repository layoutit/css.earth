import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/flora/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'flora',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/flora/flora-directional-sun.webp",
      "two": "/scenes/flora/flora-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/flora/flora-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/flora/flora-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
