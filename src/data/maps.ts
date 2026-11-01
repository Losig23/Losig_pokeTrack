/**
 * Coordinates for the Map tab, measured against the in-game Hoenn map
 * (Pokémon Emerald PokéNav map, 257x159, shown 4x at 1028x636). Town
 * positions were measured exactly from Bulbapedia's per-location map
 * files, where each town blinks in turn; route positions are placed
 * along the yellow routes between those towns. Coordinates are in
 * the 1028x636 viewBox, i.e. 4x the source image.
 *
 * The background image itself (public/hoenn-map.png) is a screenshot
 * from Pokémon Emerald, © Nintendo / Game Freak / The Pokémon
 * Company, used under a fair-use claim for this personal,
 * non-commercial run tracker; see the credit line under the map.
 */
export interface MapPoint {
  x: number;
  y: number;
}

export interface RegionMap {
  areas: Record<string, MapPoint>;
  bosses: Record<string, MapPoint>;
  story: Record<string, MapPoint>;
}

export const REGION_MAPS: Record<string, RegionMap> = {
  emerald: {
    areas: {
      "littleroot-town": { x: 174, y: 430 },
      "hoenn-route-101": { x: 172, y: 392 },
      "hoenn-route-103": { x: 224, y: 428 },
      "hoenn-route-102": { x: 124, y: 380 },
      "petalburg-city": { x: 78, y: 366 },
      "hoenn-route-104": { x: 60, y: 312 },
      "petalburg-woods": { x: 64, y: 288 },
      "rustboro-city": { x: 46, y: 254 },
      "hoenn-route-116": { x: 104, y: 252 },
      "rusturf-tunnel": { x: 144, y: 252 },
      "hoenn-route-106": { x: 80, y: 448 },
      "dewford-town": { x: 108, y: 526 },
      "granite-cave": { x: 108, y: 488 },
      "hoenn-route-109": { x: 208, y: 456 },
      "slateport-city": { x: 304, y: 416 },
      "hoenn-route-110": { x: 312, y: 344 },
      "hoenn-route-117": { x: 256, y: 268 },
      "hoenn-route-111": { x: 320, y: 200 },
      "fiery-path": { x: 256, y: 180 },
      "hoenn-route-112": { x: 224, y: 136 },
      "hoenn-route-113": { x: 288, y: 116 },
      "hoenn-route-114": { x: 384, y: 100 },
      "meteor-falls": { x: 488, y: 88 },
      "hoenn-route-115": { x: 56, y: 200 },
      "jagged-pass": { x: 240, y: 136 },
      "lavaridge-town": { x: 204, y: 174 },
      "mirage-tower": { x: 352, y: 220 },
      "hoenn-route-105": { x: 40, y: 400 },
      "hoenn-route-107": { x: 144, y: 560 },
      "hoenn-route-108": { x: 208, y: 536 },
      "abandoned-ship": { x: 176, y: 496 },
      "new-mauville": { x: 344, y: 288 },
      "hoenn-route-118": { x: 384, y: 268 },
      "hoenn-route-119": { x: 400, y: 160 },
      "hoenn-route-120": { x: 504, y: 120 },
      "hoenn-route-121": { x: 576, y: 160 },
      "hoenn-safari-zone": { x: 624, y: 120 },
      "lilycove-city": { x: 638, y: 174 },
      "hoenn-route-122": { x: 640, y: 220 },
      "mt-pyre": { x: 664, y: 260 },
      "hoenn-route-123": { x: 600, y: 260 },
      "magma-hideout": { x: 248, y: 144 },
      "team-aqua-hideout": { x: 680, y: 200 },
      "team-magma-hideout": { x: 696, y: 216 },
      "hoenn-route-124": { x: 744, y: 220 },
      "hoenn-route-125": { x: 800, y: 200 },
      "shoal-cave": { x: 820, y: 180 },
      "mossdeep-city": { x: 830, y: 238 },
      "hoenn-route-127": { x: 820, y: 280 },
      "hoenn-route-128": { x: 764, y: 320 },
      "seafloor-cavern": { x: 740, y: 336 },
      "sootopolis-city": { x: 716, y: 302 },
      "cave-of-origin": { x: 732, y: 312 },
      "hoenn-route-129": { x: 664, y: 344 },
      "hoenn-route-130": { x: 624, y: 380 },
      "pacifidlog-town": { x: 588, y: 398 },
      "hoenn-route-131": { x: 560, y: 344 },
      "hoenn-route-132": { x: 504, y: 360 },
      "hoenn-route-133": { x: 448, y: 360 },
      "hoenn-route-134": { x: 384, y: 360 },
      "sky-pillar": { x: 560, y: 296 },
      "hoenn-route-126": { x: 840, y: 296 },
      "ever-grande-city": { x: 910, y: 350 },
      "hoenn-victory-road": { x: 908, y: 312 },
    },
    // Gym cities whose boss point is not their segment's last area
    // (Mauville, Fortree) plus the League, past Victory Road.
    bosses: {
      "wattson": { x: 318, y: 270 },
      "winona": { x: 428, y: 78 },
      "wallace": { x: 910, y: 350 },
    },
    story: {
      "rival-route-103-treecko": { x: 232, y: 416 },
      "rival-route-103-torchic": { x: 232, y: 416 },
      "rival-route-103-mudkip": { x: 232, y: 416 },
      "rival-rustboro-treecko": { x: 60, y: 240 },
      "rival-rustboro-torchic": { x: 60, y: 240 },
      "rival-rustboro-mudkip": { x: 60, y: 240 },
      "rival-route-110-treecko": { x: 328, y: 336 },
      "rival-route-110-torchic": { x: 328, y: 336 },
      "rival-route-110-mudkip": { x: 328, y: 336 },
      "wally-mauville": { x: 336, y: 256 },
      "tabitha-mt-chimney": { x: 232, y: 104 },
      "maxie-mt-chimney": { x: 252, y: 104 },
      "shelly-weather-institute": { x: 392, y: 144 },
      "rival-route-119-treecko": { x: 416, y: 152 },
      "rival-route-119-torchic": { x: 416, y: 152 },
      "rival-route-119-mudkip": { x: 416, y: 152 },
      "rival-lilycove-treecko": { x: 656, y: 160 },
      "rival-lilycove-torchic": { x: 656, y: 160 },
      "rival-lilycove-mudkip": { x: 656, y: 160 },
      "tabitha-magma-hideout": { x: 232, y: 152 },
      "maxie-magma-hideout": { x: 264, y: 152 },
      "matt-aqua-hideout": { x: 696, y: 192 },
      "maxie-space-center": { x: 812, y: 224 },
      "tabitha-space-center": { x: 848, y: 224 },
      "shelly-seafloor": { x: 724, y: 328 },
      "archie-seafloor": { x: 756, y: 328 },
      "wally-victory-road": { x: 888, y: 304 },
    },
  },
};

/** One colour per gym leg, cycling through the neon accents. */
export const SEGMENT_COLORS = ["#6ea8fe", "#c084fc", "#f472b6", "#22d3ee"];
