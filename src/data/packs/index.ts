import type { GamePack } from "../../engine/types";
import radicalRed from "./radical-red.json";
import unbound from "./unbound.json";
import renegadePlatinum from "./renegade-platinum.json";
import redBlue from "./red-blue.json";
import yellow from "./yellow.json";
import goldSilver from "./gold-silver.json";
import crystal from "./crystal.json";
import rubySapphire from "./ruby-sapphire.json";
import emerald from "./emerald.json";
import fireredLeafgreen from "./firered-leafgreen.json";
import diamondPearl from "./diamond-pearl.json";
import platinum from "./platinum.json";
import heartgoldSoulsilver from "./heartgold-soulsilver.json";
import blackWhite from "./black-white.json";
import black2White2 from "./black-2-white-2.json";
import xY from "./x-y.json";
import omegaRubyAlphaSapphire from "./omega-ruby-alpha-sapphire.json";
import sunMoon from "./sun-moon.json";
import ultraSunUltraMoon from "./ultra-sun-ultra-moon.json";
import letsGo from "./lets-go.json";
import swordShield from "./sword-shield.json";
import brilliantDiamondShiningPearl from "./brilliant-diamond-shining-pearl.json";
import legendsArceus from "./legends-arceus.json";
import scarletViolet from "./scarlet-violet.json";
import legendsZa from "./legends-za.json";

const hack = (json: unknown): GamePack => ({ ...(json as GamePack), category: "hack" });
const base = (json: unknown): GamePack => ({ ...(json as GamePack), category: "base" });

export const PACKS: GamePack[] = [
  // ROM hacks (launch packs)
  hack(radicalRed),
  hack(unbound),
  hack(renegadePlatinum),
  // Mainline base games, by generation
  base(redBlue),
  base(yellow),
  base(goldSilver),
  base(crystal),
  base(rubySapphire),
  base(emerald),
  base(fireredLeafgreen),
  base(diamondPearl),
  base(platinum),
  base(heartgoldSoulsilver),
  base(blackWhite),
  base(black2White2),
  base(xY),
  base(omegaRubyAlphaSapphire),
  base(sunMoon),
  base(ultraSunUltraMoon),
  base(letsGo),
  base(swordShield),
  base(brilliantDiamondShiningPearl),
  base(legendsArceus),
  base(scarletViolet),
  base(legendsZa),
];

export function getPack(id: string): GamePack | undefined {
  return PACKS.find((p) => p.id === id);
}

/** ROM hacks / fan games on the roadmap (spec §6). Packs land one at a time without engine changes. */
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
