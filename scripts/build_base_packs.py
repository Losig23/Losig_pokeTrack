#!/usr/bin/env python3
"""Build base-game packs for RunBook.

Encounter pools come from PokéAPI's published CSV tables (the same data
behind pokeapi.co): encounters are aggregated to location level (sub-areas
merged) across the versions in each version group. Boss teams come from
~/workspace/basegame-data/bosses-*.json (community-documented, gathered
separately) and are merged in when present.

Usage: python3 scripts/build_base_packs.py
Downloads CSVs once into scripts/.cache/ (gitignored).
"""
import csv
import json
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
BOSS_DIR = Path.home() / "workspace" / "basegame-data"
OUT_DIR = REPO / "src" / "data" / "packs"

CSV_FILES = [
    "versions.csv", "version_groups.csv", "encounters.csv",
    "encounter_slots.csv", "encounter_methods.csv", "location_areas.csv",
    "locations.csv", "pokemon.csv", "pokemon_species.csv",
]
CSV_BASES = [
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/",
    "https://raw.githubusercontent.com/PokeAPI/data/master/data/v2/csv/",
    "https://raw.githubusercontent.com/veekun/pokedex/master/pokedex/data/csv/",
]

# id, display name, baseGame label, generation, PokéAPI version-group identifier (or None)
PACKS = [
    ("red-blue", "Pokémon Red & Blue", "Red / Blue", 1, "red-blue"),
    ("yellow", "Pokémon Yellow", "Yellow", 1, "yellow"),
    ("gold-silver", "Pokémon Gold & Silver", "Gold / Silver", 2, "gold-silver"),
    ("crystal", "Pokémon Crystal", "Crystal", 2, "crystal"),
    ("ruby-sapphire", "Pokémon Ruby & Sapphire", "Ruby / Sapphire", 3, "ruby-sapphire"),
    ("emerald", "Pokémon Emerald", "Emerald", 3, "emerald"),
    ("firered-leafgreen", "Pokémon FireRed & LeafGreen", "FireRed / LeafGreen", 3, "firered-leafgreen"),
    ("diamond-pearl", "Pokémon Diamond & Pearl", "Diamond / Pearl", 4, "diamond-pearl"),
    ("platinum", "Pokémon Platinum", "Platinum", 4, "platinum"),
    ("heartgold-soulsilver", "Pokémon HeartGold & SoulSilver", "HeartGold / SoulSilver", 4, "heartgold-soulsilver"),
    ("black-white", "Pokémon Black & White", "Black / White", 5, "black-white"),
    ("black-2-white-2", "Pokémon Black 2 & White 2", "Black 2 / White 2", 5, "black-2-white-2"),
    ("x-y", "Pokémon X & Y", "X / Y", 6, "x-y"),
    ("omega-ruby-alpha-sapphire", "Pokémon Omega Ruby & Alpha Sapphire", "Omega Ruby / Alpha Sapphire", 6, "omega-ruby-alpha-sapphire"),
    ("sun-moon", "Pokémon Sun & Moon", "Sun / Moon", 7, "sun-moon"),
    ("ultra-sun-ultra-moon", "Pokémon Ultra Sun & Ultra Moon", "Ultra Sun / Ultra Moon", 7, "ultra-sun-ultra-moon"),
    ("lets-go", "Pokémon Let's Go, Pikachu! & Eevee!", "Let's Go Pikachu / Eevee", 7, "lets-go-pikachu-lets-go-eevee"),
    ("sword-shield", "Pokémon Sword & Shield", "Sword / Shield", 8, "sword-shield"),
    ("brilliant-diamond-shining-pearl", "Pokémon Brilliant Diamond & Shining Pearl", "Brilliant Diamond / Shining Pearl", 8, "brilliant-diamond-and-shining-pearl"),
    ("legends-arceus", "Pokémon Legends: Arceus", "Legends: Arceus", 8, "legends-arceus"),
    ("scarlet-violet", "Pokémon Scarlet & Violet", "Scarlet / Violet", 9, "scarlet-violet"),
    ("legends-za", "Pokémon Legends: Z-A", "Legends: Z-A", 9, None),
]

FIXUPS = {"ss": "S.S.", "mt": "Mt.", "jr": "Jr.", "mr": "Mr."}

# Not wild/catchable encounters for run-logging purposes (in-game trades,
# raid dens, event distributions, snag battles in side games, island scan).
EXCLUDE_METHODS = {
    "npc-trade", "max-raid", "dynamax-adventure", "island-scan", "snag",
    "snag-rematch", "pokemon-ranger", "colosseum-bonus-disc-jpn",
    "colosseum-bonus-disc-us", "pokemon-channel-pal",
}
# Land-encounter methods used to estimate an area's place in game progression.
WALK_METHODS = {"walk", "dark-grass", "grass-spots", "cave-spots", "rough-terrain",
                "headbutt", "headbutt-low", "headbutt-normal", "headbutt-high"}


def pretty(identifier: str) -> str:
    words = []
    for w in identifier.replace("_", "-").split("-"):
        words.append(FIXUPS.get(w, w.capitalize() if not w.isdigit() else w))
    return " ".join(words)


def fetch_csv(name: str) -> list[dict]:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        last_err = None
        for base in CSV_BASES:
            try:
                req = urllib.request.Request(base + name, headers={"User-Agent": "RunBook-pack-builder"})
                with urllib.request.urlopen(req, timeout=120) as resp:
                    path.write_bytes(resp.read())
                break
            except Exception as e:  # noqa: BLE001 - try next mirror
                last_err = e
        else:
            raise SystemExit(f"could not download {name}: {last_err}")
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    versions = fetch_csv("versions.csv")
    version_groups = fetch_csv("version_groups.csv")
    encounters = fetch_csv("encounters.csv")
    slots = fetch_csv("encounter_slots.csv")
    methods = fetch_csv("encounter_methods.csv")
    location_areas = fetch_csv("location_areas.csv")
    locations = fetch_csv("locations.csv")
    pokemon = fetch_csv("pokemon.csv")
    species = fetch_csv("pokemon_species.csv")

    vg_id = {vg["identifier"]: int(vg["id"]) for vg in version_groups}
    versions_by_vg: dict[int, set[int]] = {}
    for v in versions:
        versions_by_vg.setdefault(int(v["version_group_id"]), set()).add(int(v["id"]))
    method_by_slot = {}
    method_name = {int(m["id"]): m["identifier"] for m in methods}
    for s in slots:
        method_by_slot[int(s["id"])] = method_name.get(int(s["encounter_method_id"]), "walk")
    location_by_area = {int(a["id"]): int(a["location_id"]) for a in location_areas}
    location_ident = {int(l["id"]): l["identifier"] for l in locations}
    species_by_pokemon = {int(p["id"]): int(p["species_id"]) for p in pokemon}
    species_ident = {int(s["id"]): s["identifier"] for s in species}
    # Legendary only: mythical statics include legitimate one-off
    # encounters (Victini at Liberty Garden) that runs may count.
    legendary_species = {
        s["identifier"] for s in species if s.get("is_legendary") == "1"
    }

    # Boss data gathered separately (one file per generation, keyed by pack id)
    boss_data: dict[str, dict] = {}
    if BOSS_DIR.exists():
        for f in sorted(BOSS_DIR.glob("bosses-*.json")):
            boss_data.update(json.loads(f.read_text()))

    for pack_id, name, base_game, gen, vg_ident in PACKS:
        areas: list[dict] = []
        if vg_ident and vg_ident in vg_id:
            vset = versions_by_vg.get(vg_id[vg_ident], set())
            # (location_id, species) -> [min, max, {methods}] (merged across methods)
            agg: dict[tuple[int, str], list] = {}
            # Raw per-row levels for progression ranking: merged per-species
            # ranges mix methods (a species' Surf range drags its walking
            # range down), so ranking must read the un-merged rows.
            land_mins: dict[int, list[int]] = {}
            row_mids: dict[int, list[float]] = {}
            for row in encounters:
                if int(row["version_id"]) not in vset:
                    continue
                method = method_by_slot.get(int(row["encounter_slot_id"]), "walk")
                if method in EXCLUDE_METHODS:
                    continue
                loc = location_by_area.get(int(row["location_area_id"]))
                if loc is None:
                    continue
                sp = species_ident.get(species_by_pokemon.get(int(row["pokemon_id"]), -1))
                if not sp:
                    continue
                # Scripted legendary/mythical fights are not route
                # encounters — and the source data dumps roaming-legendary
                # statics on an unnamed area that otherwise surfaces as a
                # junk cross-game location in every pack.
                if method == "static" and sp in legendary_species:
                    continue
                lo_r, hi_r = int(row["min_level"]), int(row["max_level"])
                if method in WALK_METHODS:
                    land_mins.setdefault(loc, []).append(lo_r)
                row_mids.setdefault(loc, []).append((lo_r + hi_r) / 2)
                key = (loc, sp)
                lo, hi = int(row["min_level"]), int(row["max_level"])
                if key in agg:
                    agg[key][0] = min(agg[key][0], lo)
                    agg[key][1] = max(agg[key][1], hi)
                    agg[key][2].add(method)
                else:
                    agg[key] = [lo, hi, {method}]
            by_loc: dict[int, list[dict]] = {}
            for (loc, sp), (lo, hi, method_set) in agg.items():
                by_loc.setdefault(loc, []).append(
                    {"species": sp, "minLevel": lo, "maxLevel": hi, "methods": sorted(method_set)}
                )

            def progression_key(loc: int) -> tuple[float, float, str]:
                # Story position is set by an area's EARLIEST LAND
                # encounters (raw per-method rows — merged ranges mix Surf
                # levels into walking ranges and poison the ranking):
                # post-game stragglers (BW Route 1's dark-grass Lv 32+
                # forms) otherwise drag starter routes to the end, and
                # water tables (Lv 5 fishing ranges even in endgame areas)
                # drag late areas to the front. Areas with no land rows
                # (water-only, gift-only cities) rank by their rows'
                # median level midpoint instead.
                land = sorted(land_mins.get(loc, []))
                if land:
                    return (land[0], land[len(land) // 2], location_ident.get(loc, ""))
                mids = sorted(row_mids.get(loc, []))
                median = mids[len(mids) // 2] if mids else 999
                return (median, median, location_ident.get(loc, ""))

            sorted_locs = sorted(by_loc, key=progression_key)
            # Story-progression chains: level heuristics still misplace
            # areas that unlock via HMs or events, so packs with a chain
            # get their main route pinned to the order the game actually
            # unfolds (each entry placed immediately after the previous).
            # Unlisted areas keep their heuristic positions.
            STORY_CHAINS = {
                "black-white": [
                    "nuvema-town", "unova-route-1", "unova-route-2", "striaton-city",
                    "dreamyard", "unova-route-3", "wellspring-cave", "nacrene-city",
                    "pinwheel-forest", "castelia-city", "liberty-garden", "unova-route-4",
                    "desert-resort", "relic-castle", "unova-route-16", "lostlorn-forest",
                    "unova-route-5", "driftveil-drawbridge", "driftveil-city",
                    "cold-storage", "unova-route-6", "chargestone-cave", "mistralton-cave",
                    "unova-route-7", "celestial-tower", "twist-mountain", "icirrus-city",
                    "dragonspiral-tower", "unova-route-8", "moor-of-icirrus",
                    "unova-route-9", "unova-route-10", "unova-victory-road",
                    "trial-chamber", "guidance-chamber", "unova-route-11",
                    "village-bridge", "unova-route-12", "unova-route-13", "undella-town",
                    "undella-bay", "unova-route-14", "abundant-shrine", "unova-route-15",
                    "marvelous-bridge", "unova-route-17", "unova-route-18",
                    "p2-laboratory", "giant-chasm", "challengers-cave", "ns-castle",
                ],
            }
            chain = STORY_CHAINS.get(pack_id, [])
            for prev_ident, area_ident in zip(chain, chain[1:]):
                area_loc = next(
                    (l for l in sorted_locs if location_ident.get(l) == area_ident), None
                )
                anchor_loc = next(
                    (l for l in sorted_locs if location_ident.get(l) == prev_ident), None
                )
                if area_loc is not None and anchor_loc is not None and area_loc != anchor_loc:
                    sorted_locs.remove(area_loc)
                    sorted_locs.insert(sorted_locs.index(anchor_loc) + 1, area_loc)

            for i, loc in enumerate(sorted_locs):
                ident = location_ident.get(loc, f"location-{loc}")
                areas.append({
                    "id": ident,
                    "name": pretty(ident),
                    "order": (i + 1) * 10,
                    "encounters": sorted(by_loc[loc], key=lambda e: e["species"]),
                })

        bd = boss_data.get(pack_id, {})
        bosses = bd.get("bosses", [])
        sources = ["https://github.com/PokeAPI/pokeapi — data/v2/csv encounter tables (PokéAPI)"] + bd.get("sources", [])
        notes_parts = [
            "Base-game pack. Encounter pools generated from PokéAPI data, merged to location level across sub-areas, encounter methods, and the paired versions (in-game trades and raid/event distributions excluded); area order is estimated from encounter levels and is approximate.",
        ]
        if not areas:
            notes_parts.append("No encounter tables are available from PokéAPI for this game — use custom areas in the encounter log to track catches.")
        if not bosses:
            notes_parts.append("Boss data is still being gathered for this pack.")
        if bd.get("notes"):
            notes_parts.append(bd["notes"])
        pack = {
            "id": pack_id,
            "name": name,
            "version": "1.0",
            "baseGame": base_game,
            "generation": gen,
            "category": "base",
            "sourceDocs": sources,
            "dataQuality": "community" if (areas and bosses) else "partial",
            "notes": " ".join(notes_parts),
            "areas": areas,
            "bosses": bosses,
        }
        out = OUT_DIR / f"{pack_id}.json"
        out.write_text(json.dumps(pack, indent=1, ensure_ascii=False) + "\n")
        n_enc = sum(len(a["encounters"]) for a in areas)
        print(f"{pack_id:38s} areas={len(areas):4d} encounters={n_enc:5d} bosses={len(bosses):3d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
