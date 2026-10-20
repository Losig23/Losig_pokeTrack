import { useEffect, useState } from "react";
import type { SpeciesData } from "../engine/types";

// Species data comes from PokéAPI at runtime and is cached in localStorage.
// Game packs only store slugs, so packs stay small and hack-agnostic; a pack's
// pokemonOverrides (future) will layer hack-specific changes on top of this.

const CACHE_PREFIX = "runbook-species-";

function readCache(slug: string): SpeciesData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    return raw ? (JSON.parse(raw) as SpeciesData) : null;
  } catch {
    return null;
  }
}

function writeCache(data: SpeciesData) {
  try {
    localStorage.setItem(CACHE_PREFIX + data.slug, JSON.stringify(data));
  } catch {
    // cache is best-effort (quota / private mode)
  }
}

interface PokeApiPokemon {
  id: number;
  name: string;
  types: { type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  sprites: {
    front_default: string | null;
    other?: { "official-artwork"?: { front_default: string | null } };
  };
}

// PokéAPI has no bare endpoint for some species — the default form's slug is required.
const SLUG_ALIASES: Record<string, string> = {
  basculin: "basculin-red-striped",
  deoxys: "deoxys-normal",
  wormadam: "wormadam-plant",
  giratina: "giratina-altered",
  shaymin: "shaymin-land",
  tornadus: "tornadus-incarnate",
  thundurus: "thundurus-incarnate",
  landorus: "landorus-incarnate",
  enamorus: "enamorus-incarnate",
  keldeo: "keldeo-ordinary",
  meloetta: "meloetta-aria",
  darmanitan: "darmanitan-standard",
  aegislash: "aegislash-shield",
  wishiwashi: "wishiwashi-solo",
  minior: "minior-red-meteor",
  mimikyu: "mimikyu-disguised",
  toxtricity: "toxtricity-amped",
  indeedee: "indeedee-male",
  eiscue: "eiscue-ice",
  urshifu: "urshifu-single-strike",
  oricorio: "oricorio-baile",
  pumpkaboo: "pumpkaboo-average",
  gourgeist: "gourgeist-average",
  oinkologne: "oinkologne-male",
  maushold: "maushold-family-of-four",
  palafin: "palafin-zero",
  tatsugiri: "tatsugiri-curly",
  dudunsparce: "dudunsparce-two-segment",
  squawkabilly: "squawkabilly-green-plumage",
  pyroar: "pyroar-male", // PokéAPI has no bare "pyroar" pokemon entry, only its forms
  frillish: "frillish-male",
  jellicent: "jellicent-male",
  lycanroc: "lycanroc-midday",
  meowstic: "meowstic-male",
  morpeko: "morpeko-full-belly",
  zygarde: "zygarde-50",
};

export async function fetchSpecies(slug: string): Promise<SpeciesData | null> {
  const cached = readCache(slug);
  if (cached) return cached;
  try {
    let res = await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    if (!res.ok && SLUG_ALIASES[slug]) {
      res = await fetch(`https://pokeapi.co/api/v2/pokemon/${SLUG_ALIASES[slug]}`);
    }
    if (!res.ok) return null;
    const p = (await res.json()) as PokeApiPokemon;
    const stat = (name: string) =>
      p.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
    const data: SpeciesData = {
      id: p.id,
      slug: p.name,
      name: p.name,
      types: p.types.map((t) => t.type.name),
      baseStats: {
        hp: stat("hp"),
        attack: stat("attack"),
        defense: stat("defense"),
        specialAttack: stat("special-attack"),
        specialDefense: stat("special-defense"),
        speed: stat("speed"),
      },
      sprite:
        p.sprites.front_default ??
        p.sprites.other?.["official-artwork"]?.front_default ??
        "",
    };
    writeCache(data);
    if (data.slug !== slug) {
      // alias form fetched under a different slug — also cache under the requested slug
      try {
        localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify(data));
      } catch { /* best-effort */ }
    }
    return data;
  } catch {
    return null;
  }
}

/** Load SpeciesData for a set of slugs; returns a slug → data map that fills in as fetches land. */
export function useSpeciesData(slugs: string[]): Record<string, SpeciesData> {
  const [map, setMap] = useState<Record<string, SpeciesData>>({});
  const key = [...new Set(slugs)].sort().join(",");
  useEffect(() => {
    let cancelled = false;
    const unique = key ? key.split(",") : [];
    for (const slug of unique) {
      const cached = readCache(slug);
      if (cached) {
        setMap((prev) => (prev[slug] ? prev : { ...prev, [slug]: cached }));
      } else {
        void fetchSpecies(slug).then((data) => {
          if (!cancelled && data) setMap((prev) => ({ ...prev, [slug]: data }));
        });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [key]);
  return map;
}

export function displayName(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
