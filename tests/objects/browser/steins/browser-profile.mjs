import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/steins/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'steins',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/steins/steins-directional-sun.webp",
      "two": "/scenes/steins/steins-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/steins/steins-normal-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "normal",
    "slowId": "elevation",
    "winnerId": "normal",
    "slowAsset": "/scenes/steins/steins-elevation-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "normal",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
