// Core data model for RunBook (Losig_pokeTrack).
// A "game pack" is pure data: one JSON file per ROM hack. The engine and UI
// are game-agnostic — everything game-specific lives in the pack.

export interface EncounterPoolEntry {
  species: string; // PokéAPI slug, e.g. "pidgey", "nidoran-f", "mr-mime"
  form?: string; // e.g. "alolan" when the hack uses a regional form here
  minLevel: number;
  maxLevel: number;
  methods: string[]; // "grass" | "water" | "surf" | "fish" | "gift" | "static" | ...
}

export interface Area {
  id: string;
  name: string;
  order: number;
  encounters: EncounterPoolEntry[];
}

export interface BossMon {
  species: string; // PokéAPI slug
  form?: string;
  level: number;
  ability?: string | null;
  item?: string | null;
  moves: string[];
}

export interface Boss {
  id: string;
  name: string;
  location: string;
  order: number;
  levelCap: number; // level of the boss's ace
  team: BossMon[];
}

export type PackCategory = "base" | "hack" | "fangame";

export interface GamePack {
  id: string;
  name: string;
  version: string;
  baseGame: string;
  generation: number;
  category: PackCategory;
  sourceDocs: string[];
  dataQuality: "verified" | "community" | "partial";
  notes?: string;
  areas: Area[];
  bosses: Boss[];
  pokemonOverrides?: Record<string, unknown>;
}

export type StatKey = "hp" | "attack" | "defense" | "specialAttack" | "specialDefense" | "speed";

export type Ruleset = "casual" | "nuzlocke" | "hardcore";

export type MonStatus = "party" | "box" | "graveyard";
export type EncounterOutcome = "caught" | "missed" | "fainted" | "skipped";

export interface CaughtMon {
  uid: string;
  species: string;
  form?: string;
  nickname?: string;
  level: number;
  nature?: string;
  ability?: string;
  /** Effort values the player has recorded (0–252 per stat). */
  evs?: Partial<Record<StatKey, number>>;
  /** The stats as shown on the Pokémon's summary screen — IVs are derived from these. */
  actualStats?: Partial<Record<StatKey, number>>;
  status: MonStatus;
  caughtAreaId: string;
}

export interface EncounterLogEntry {
  areaId: string;
  outcome: EncounterOutcome;
  species?: string; // species encountered (the pool pick or actual spawn)
  monUid?: string; // set when outcome created a CaughtMon
}

export interface Run {
  id: string;
  packId: string;
  ruleset: Ruleset;
  name: string;
  createdAt: string; // ISO date
  status: "in-progress" | "won" | "wiped";
  attempts: number;
  encounters: EncounterLogEntry[];
  team: CaughtMon[];
  defeatedBossIds: string[];
  /** Areas the player added themselves (for packs without encounter tables). */
  customAreas?: Area[];
}

export interface SpeciesData {
  id: number; // National Dex number
  slug: string;
  name: string;
  types: string[]; // lowercase type names, 1–2 entries
  baseStats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  sprite: string; // URL
}
