import type { StatKey } from "./types";

// IV (individual value) math, Gen III+ stat formula.
//   HP:    floor((2·Base + IV + floor(EV/4)) · Level/100) + Level + 10
//   Other: floor((floor((2·Base + IV + floor(EV/4)) · Level/100) + 5) · nature)
// Given a Pokémon's actual on-screen stats, its level, nature and EVs, the
// solver brute-forces IV 0–31 per stat and returns the range that reproduces
// the observed stat exactly. At low levels several IVs often map to the
// same stat, so the honest answer is a range that narrows as it levels up.

export const STAT_KEYS: StatKey[] = [
  "hp", "attack", "defense", "specialAttack", "specialDefense", "speed",
];

export const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  specialAttack: "SpA",
  specialDefense: "SpD",
  speed: "Spe",
};

export interface NatureInfo {
  name: string;
  up: StatKey | null; // boosted stat (×1.1); null for neutral natures
  down: StatKey | null; // hindered stat (×0.9)
}

const n = (name: string, up: StatKey | null = null, down: StatKey | null = null): NatureInfo =>
  ({ name, up, down });

export const NATURES: NatureInfo[] = [
  n("Hardy"), n("Lonely", "attack", "defense"), n("Brave", "attack", "speed"),
  n("Adamant", "attack", "specialAttack"), n("Naughty", "attack", "specialDefense"),
  n("Bold", "defense", "attack"), n("Docile"), n("Relaxed", "defense", "speed"),
  n("Impish", "defense", "specialAttack"), n("Lax", "defense", "specialDefense"),
  n("Timid", "speed", "attack"), n("Hasty", "speed", "defense"), n("Serious"),
  n("Jolly", "speed", "specialAttack"), n("Naive", "speed", "specialDefense"),
  n("Modest", "specialAttack", "attack"), n("Mild", "specialAttack", "defense"),
  n("Quiet", "specialAttack", "speed"), n("Bashful"), n("Rash", "specialAttack", "specialDefense"),
  n("Calm", "specialDefense", "attack"), n("Gentle", "specialDefense", "defense"),
  n("Sassy", "specialDefense", "speed"), n("Careful", "specialDefense", "specialAttack"),
  n("Quirky"),
];

export function natureInfo(name: string | undefined): NatureInfo {
  return NATURES.find((x) => x.name.toLowerCase() === (name ?? "").toLowerCase()) ?? NATURES[0];
}

export function natureModifier(nature: string | undefined, stat: StatKey): number {
  if (stat === "hp") return 1;
  const info = natureInfo(nature);
  if (info.up === stat) return 1.1;
  if (info.down === stat) return 0.9;
  return 1;
}

/** The stat a Pokémon with these exact values would show on its summary screen. */
export function computeStat(
  base: number, iv: number, ev: number, level: number, stat: StatKey, nature?: string,
): number {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === "hp") return core + level + 10;
  return Math.floor((core + 5) * natureModifier(nature, stat));
}

export interface IvResult {
  min: number;
  max: number;
}

/**
 * Every IV consistent with the observed stat, as a [min, max] range.
 * Returns null when no IV reproduces the stat (bad input — wrong nature,
 * EVs, or a typo), so the UI can flag it instead of showing a wrong number.
 */
export function ivRange(
  base: number, level: number, ev: number, observed: number, stat: StatKey, nature?: string,
): IvResult | null {
  let min: number | null = null;
  let max: number | null = null;
  for (let iv = 0; iv <= 31; iv++) {
    if (computeStat(base, iv, ev, level, stat, nature) === observed) {
      if (min === null) min = iv;
      max = iv;
    }
  }
  return min === null || max === null ? null : { min, max };
}
