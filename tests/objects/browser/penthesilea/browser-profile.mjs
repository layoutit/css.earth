import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/penthesilea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'penthesilea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/penthesilea/penthesilea-directional-sun.webp",
      "two": "/scenes/penthesilea/penthesilea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/penthesilea/penthesilea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/penthesilea/penthesilea-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
