/**
 * Schematic region maps: hand-placed coordinates for a pack's areas,
 * gym-boss locations and story-boss locations. These are approximations
 * of the region's geography (not to scale, not a traced official map),
 * used only to draw the journey path in the Map tab. A pack without an
 * entry here simply has no Map tab yet.
 *
 * Coordinates are in a 1000x700 space. Areas are keyed by area id,
 * bosses by boss id, story bosses by story-boss id.
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
      "littleroot-town": { x: 300, y: 560 },
      "hoenn-route-101": { x: 300, y: 500 },
      "hoenn-route-103": { x: 380, y: 560 },
      "hoenn-route-102": { x: 220, y: 540 },
      "petalburg-city": { x: 180, y: 480 },
      "hoenn-route-104": { x: 180, y: 400 },
      "petalburg-woods": { x: 170, y: 340 },
      "rustboro-city": { x: 180, y: 260 },
      "hoenn-route-116": { x: 260, y: 260 },
      "rusturf-tunnel": { x: 320, y: 280 },
      "hoenn-route-106": { x: 120, y: 500 },
      "dewford-town": { x: 90, y: 560 },
      "granite-cave": { x: 90, y: 500 },
      "hoenn-route-109": { x: 220, y: 580 },
      "slateport-city": { x: 320, y: 600 },
      "hoenn-route-110": { x: 380, y: 500 },
      "hoenn-route-117": { x: 320, y: 440 },
      "hoenn-route-111": { x: 430, y: 350 },
      "fiery-path": { x: 380, y: 300 },
      "hoenn-route-112": { x: 360, y: 250 },
      "hoenn-route-113": { x: 470, y: 250 },
      "hoenn-route-114": { x: 540, y: 230 },
      "meteor-falls": { x: 590, y: 220 },
      "hoenn-route-115": { x: 230, y: 180 },
      "jagged-pass": { x: 360, y: 210 },
      "lavaridge-town": { x: 360, y: 280 },
      "mirage-tower": { x: 430, y: 380 },
      "hoenn-route-105": { x: 120, y: 470 },
      "hoenn-route-107": { x: 150, y: 540 },
      "hoenn-route-108": { x: 200, y: 600 },
      "abandoned-ship": { x: 160, y: 620 },
      "new-mauville": { x: 430, y: 470 },
      "hoenn-route-118": { x: 470, y: 440 },
      "hoenn-route-119": { x: 520, y: 380 },
      "hoenn-route-120": { x: 560, y: 400 },
      "hoenn-route-121": { x: 640, y: 420 },
      "hoenn-safari-zone": { x: 640, y: 360 },
      "lilycove-city": { x: 700, y: 430 },
      "hoenn-route-122": { x: 660, y: 500 },
      "mt-pyre": { x: 700, y: 540 },
      "hoenn-route-123": { x: 620, y: 500 },
      "magma-hideout": { x: 330, y: 230 },
      "team-aqua-hideout": { x: 700, y: 470 },
      "team-magma-hideout": { x: 730, y: 470 },
      "hoenn-route-124": { x: 760, y: 470 },
      "hoenn-route-125": { x: 820, y: 430 },
      "shoal-cave": { x: 840, y: 380 },
      "mossdeep-city": { x: 880, y: 430 },
      "hoenn-route-127": { x: 860, y: 500 },
      "hoenn-route-128": { x: 800, y: 540 },
      "seafloor-cavern": { x: 760, y: 580 },
      "sootopolis-city": { x: 720, y: 600 },
      "cave-of-origin": { x: 745, y: 615 },
      "hoenn-route-129": { x: 620, y: 620 },
      "hoenn-route-130": { x: 520, y: 620 },
      "pacifidlog-town": { x: 420, y: 620 },
      "hoenn-route-131": { x: 420, y: 540 },
      "hoenn-route-132": { x: 340, y: 540 },
      "hoenn-route-133": { x: 280, y: 540 },
      "hoenn-route-134": { x: 220, y: 540 },
      "sky-pillar": { x: 400, y: 500 },
      "hoenn-route-126": { x: 800, y: 480 },
      "ever-grande-city": { x: 880, y: 380 },
      "hoenn-victory-road": { x: 880, y: 320 },
    },
    // Gym cities with no encounter area of their own (Mauville,
    // Fortree) plus the League, which sits past Victory Road.
    bosses: {
      wattson: { x: 410, y: 430 },
      winona: { x: 560, y: 330 },
      wallace: { x: 880, y: 260 },
    },
    story: {
      "rival-route-103-treecko": { x: 405, y: 545 },
      "rival-route-103-torchic": { x: 405, y: 545 },
      "rival-route-103-mudkip": { x: 405, y: 545 },
      "rival-rustboro-treecko": { x: 205, y: 240 },
      "rival-rustboro-torchic": { x: 205, y: 240 },
      "rival-rustboro-mudkip": { x: 205, y: 240 },
      "rival-route-110-treecko": { x: 405, y: 485 },
      "rival-route-110-torchic": { x: 405, y: 485 },
      "rival-route-110-mudkip": { x: 405, y: 485 },
      "wally-mauville": { x: 435, y: 410 },
      "tabitha-mt-chimney": { x: 335, y: 235 },
      "maxie-mt-chimney": { x: 360, y: 235 },
      "shelly-weather-institute": { x: 495, y: 360 },
      "rival-route-119-treecko": { x: 545, y: 365 },
      "rival-route-119-torchic": { x: 545, y: 365 },
      "rival-route-119-mudkip": { x: 545, y: 365 },
      "rival-lilycove-treecko": { x: 725, y: 410 },
      "rival-lilycove-torchic": { x: 725, y: 410 },
      "rival-lilycove-mudkip": { x: 725, y: 410 },
      "tabitha-magma-hideout": { x: 310, y: 215 },
      "maxie-magma-hideout": { x: 350, y: 215 },
      "matt-aqua-hideout": { x: 720, y: 455 },
      "maxie-space-center": { x: 865, y: 410 },
      "tabitha-space-center": { x: 895, y: 410 },
      "shelly-seafloor": { x: 740, y: 560 },
      "archie-seafloor": { x: 775, y: 565 },
      "wally-victory-road": { x: 855, y: 305 },
    },
  },
};

/** One colour per gym leg, cycling through the neon accents. */
export const SEGMENT_COLORS = ["#6ea8fe", "#c084fc", "#f472b6", "#22d3ee"];
