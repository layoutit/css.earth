import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/interamnia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'interamnia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/interamnia/interamnia-directional-sun.webp",
      "two": "/scenes/interamnia/interamnia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/interamnia/interamnia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/interamnia/interamnia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
