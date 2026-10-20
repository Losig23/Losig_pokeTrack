import type { GamePack } from "../../engine/types";
import radicalRed from "./radical-red.json";
import unbound from "./unbound.json";
import renegadePlatinum from "./renegade-platinum.json";

export const PACKS: GamePack[] = [
  radicalRed as GamePack,
  unbound as GamePack,
  renegadePlatinum as GamePack,
];

export function getPack(id: string): GamePack | undefined {
  return PACKS.find((p) => p.id === id);
}

/** Games on the roadmap (spec §6). Packs land one at a time without engine changes. */
export const PLANNED_PACKS: { name: string; tier: number; kind: "hack" | "fangame" }[] = [
  { name: "Pokémon Inclement Emerald", tier: 1, kind: "hack" },
  { name: "Pokémon Emerald Kaizo", tier: 1, kind: "hack" },
  { name: "Pokémon Run & Bun", tier: 1, kind: "hack" },
  { name: "Pokémon Emerald Imperium", tier: 2, kind: "hack" },
  { name: "Pokémon Sacred Gold / Storm Silver", tier: 2, kind: "hack" },
  { name: "Pokémon Blaze Black / Volt White", tier: 2, kind: "hack" },
  { name: "Pokémon Gaia", tier: 3, kind: "hack" },
  { name: "Pokémon Glazed", tier: 3, kind: "hack" },
  { name: "Pokémon Prism", tier: 3, kind: "hack" },
  { name: "Pokémon Crystal Clear", tier: 3, kind: "hack" },
  { name: "Pokémon Light Platinum", tier: 3, kind: "hack" },
  { name: "Pokémon GS Chronicles", tier: 3, kind: "hack" },
  { name: "Pokémon FireRed Rocket Edition", tier: 3, kind: "hack" },
  { name: "Pokémon Polished Crystal", tier: 3, kind: "hack" },
  { name: "Pokémon Odyssey", tier: 3, kind: "hack" },
  { name: "Pokémon Reborn", tier: 3, kind: "fangame" },
  { name: "Pokémon Insurgence", tier: 3, kind: "fangame" },
];
