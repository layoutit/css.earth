import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/cerberus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cerberus',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/cerberus/cerberus-directional-sun.webp",
      "two": "/scenes/cerberus/cerberus-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/cerberus/cerberus-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/cerberus/cerberus-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
