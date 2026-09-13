import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/victoria/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'victoria',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/victoria/victoria-directional-sun.webp",
      "two": "/scenes/victoria/victoria-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/victoria/victoria-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/victoria/victoria-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
