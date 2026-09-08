import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/castalia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'castalia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/castalia/castalia-directional-sun.webp",
      "two": "/scenes/castalia/castalia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/castalia/castalia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/castalia/castalia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
