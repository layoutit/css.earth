import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/educatio/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'educatio',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/educatio/educatio-directional-sun.webp",
      "two": "/scenes/educatio/educatio-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/educatio/educatio-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/educatio/educatio-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
