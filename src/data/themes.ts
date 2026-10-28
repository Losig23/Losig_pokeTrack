/**
 * Per-game themes, dark mode only. The whole app stays black-first; a
 * game only changes its single accent colour family and its background
 * silhouette, so a run page reads as one game, not three neon gradients.
 *
 * Mascot rule: for combined packs (Red/Blue, Gold/Silver, ...) the
 * mascot is the first-named version's mascot. Home is not a game, so it
 * gets Lucario: blue and black, which is why the home accent is a steel
 * blue on black, not the red/yellow/white Poké Ball scheme.
 */
export interface PackTheme {
  /** PokéAPI species slug for the silhouette. */
  mascot: string;
  /** Human name for the mascot, for alt text. */
  mascotName: string;
  /** Main accent (buttons, badges, links, glows). */
  accent: string;
  /** Deeper shade of the same accent, for gradients and active states. */
  accentDeep: string;
  /** Lighter shade of the same accent, for hovers and secondary accents. */
  accentLight: string;
}

export const HOME_THEME: PackTheme = {
  mascot: "lucario",
  mascotName: "Lucario",
  accent: "#6ea8fe",
  accentDeep: "#3b82f6",
  accentLight: "#a8c6ff",
};

export const PACK_THEMES: Record<string, PackTheme> = {
  "red-blue": { mascot: "charizard", mascotName: "Charizard", accent: "#fb923c", accentDeep: "#ea580c", accentLight: "#fdba74" },
  yellow: { mascot: "pikachu", mascotName: "Pikachu", accent: "#ffcb05", accentDeep: "#eab308", accentLight: "#fde047" },
  "firered-leafgreen": { mascot: "charizard", mascotName: "Charizard", accent: "#f97316", accentDeep: "#dc2626", accentLight: "#fca5a5" },
  "lets-go": { mascot: "pikachu", mascotName: "Pikachu", accent: "#ffcb05", accentDeep: "#eab308", accentLight: "#fde047" },
  "gold-silver": { mascot: "ho-oh", mascotName: "Ho-Oh", accent: "#f59e0b", accentDeep: "#d97706", accentLight: "#fcd34d" },
  crystal: { mascot: "suicune", mascotName: "Suicune", accent: "#2dd4bf", accentDeep: "#0d9488", accentLight: "#5eead4" },
  "heartgold-soulsilver": { mascot: "ho-oh", mascotName: "Ho-Oh", accent: "#f59e0b", accentDeep: "#d97706", accentLight: "#fcd34d" },
  "ruby-sapphire": { mascot: "groudon", mascotName: "Groudon", accent: "#ef4444", accentDeep: "#dc2626", accentLight: "#f87171" },
  emerald: { mascot: "rayquaza", mascotName: "Rayquaza", accent: "#22c55e", accentDeep: "#16a34a", accentLight: "#4ade80" },
  "omega-ruby-alpha-sapphire": { mascot: "groudon", mascotName: "Groudon", accent: "#ef4444", accentDeep: "#dc2626", accentLight: "#f87171" },
  "diamond-pearl": { mascot: "dialga", mascotName: "Dialga", accent: "#38bdf8", accentDeep: "#0284c7", accentLight: "#7dd3fc" },
  platinum: { mascot: "giratina", mascotName: "Giratina", accent: "#a855f7", accentDeep: "#7c3aed", accentLight: "#c4b5fd" },
  "black-white": { mascot: "zekrom", mascotName: "Zekrom", accent: "#60a5fa", accentDeep: "#2563eb", accentLight: "#93c5fd" },
  "black-2-white-2": { mascot: "kyurem", mascotName: "Kyurem", accent: "#7dd3fc", accentDeep: "#0284c7", accentLight: "#bae6fd" },
  "x-y": { mascot: "xerneas", mascotName: "Xerneas", accent: "#38bdf8", accentDeep: "#2563eb", accentLight: "#7dd3fc" },
  "sun-moon": { mascot: "solgaleo", mascotName: "Solgaleo", accent: "#f59e0b", accentDeep: "#d97706", accentLight: "#fcd34d" },
  "ultra-sun-ultra-moon": { mascot: "necrozma", mascotName: "Necrozma", accent: "#eab308", accentDeep: "#a16207", accentLight: "#fde047" },
  "sword-shield": { mascot: "zacian", mascotName: "Zacian", accent: "#22d3ee", accentDeep: "#0891b2", accentLight: "#67e8f9" },
  // Boss-only packs (no areas yet) still get a run-page theme.
  "brilliant-diamond-shining-pearl": { mascot: "dialga", mascotName: "Dialga", accent: "#38bdf8", accentDeep: "#0284c7", accentLight: "#7dd3fc" },
  "legends-arceus": { mascot: "arceus", mascotName: "Arceus", accent: "#eab308", accentDeep: "#a16207", accentLight: "#fde047" },
  "scarlet-violet": { mascot: "koraidon", mascotName: "Koraidon", accent: "#ef4444", accentDeep: "#dc2626", accentLight: "#f87171" },
  // Hacks keep the old mixed-neon look for now: no per-game theme here,
  // so they fall back to HOME_THEME's blue on black.
};

export function themeForPack(packId: string | null | undefined): PackTheme {
  return packId ? (PACK_THEMES[packId] ?? HOME_THEME) : HOME_THEME;
}
