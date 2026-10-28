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

# Hand-authored timeline segmentation per pack: bossId -> the LAST area
# (in story order) whose encounters belong to that boss's segment. Packs
# listed here bypass the engine's estimation heuristics — needed when a
# hub city is visited long before its gym (Lumiose City's encounters
# happen on the first visit; Clemont is badge 5).
SEGMENT_CUTOFFS = {
    # Segment = the areas you can catch in before that boss, in chain
    # order. Backtracking games (Hoenn, Sinnoh DP, Johto Kanto) cannot
    # be sliced perfectly by a linear list — a gym city already visited
    # cannot appear twice — so these are sequential chunks in story
    # order, which still put every area in the right boss's segment
    # except where a gym is revisited later (noted in code comments
    # where that happens).
    "black-white": {
        "cilan": "striaton-city", "chili": "striaton-city", "cress": "striaton-city",
        "lenora": "nacrene-city", "burgh": "liberty-garden", "elesa": "unova-route-5",
        "clay": "unova-route-6", "skyla": "celestial-tower", "brycen": "icirrus-city",
        "drayden": "unova-route-9", "iris": "unova-route-9", "n": "trial-chamber",
    },
    "black-2-white-2": {
        "cheren": "floccesy-ranch", "roxie": "virbank-complex", "burgh": "relic-passage",
        "elesa": "unova-route-5", "clay": "driftveil-city", "skyla": "celestial-tower",
        "drayden": "unova-route-9", "marlon": "humilau-city",
    },
    "red-blue": {
        "brock": "viridian-forest", "misty": "kanto-route-25", "lt-surge": "digletts-cave",
        "erika": "celadon-city", "koga": "kanto-route-12", "sabrina": "saffron-city",
        "blaine": "pokemon-mansion", "giovanni": "kanto-victory-road-2",
    },
    "yellow": {
        "brock": "viridian-forest", "misty": "kanto-route-25", "lt-surge": "digletts-cave",
        "erika": "celadon-city", "koga": "kanto-route-12", "sabrina": "saffron-city",
        "blaine": "pokemon-mansion", "giovanni": "kanto-victory-road-2",
    },
    "firered-leafgreen": {
        "brock": "viridian-forest", "misty": "kanto-route-25", "lt-surge": "digletts-cave",
        "erika": "celadon-city", "koga": "kanto-route-12", "sabrina": "saffron-city",
        "blaine": "pokemon-mansion", "giovanni": "kanto-victory-road-2",
    },
    "lets-go": {
        "gym-leader-brock": "viridian-forest", "gym-leader-misty": "kanto-route-25",
        "gym-leader-lt-surge": "digletts-cave", "gym-leader-erika": "kanto-route-7",
        "gym-leader-koga": "kanto-route-12", "gym-leader-sabrina": "saffron-city",
        "gym-leader-blaine": "pokemon-mansion", "gym-leader-giovanni": "kanto-victory-road-1",
    },
    "gold-silver": {
        "falkner": "sprout-tower", "bugsy": "azalea-town", "whitney": "goldenrod-city",
        "morty": "burned-tower", "chuck": "cianwood-city", "jasmine": "johto-sea-route-41",
        "pryce": "lake-of-rage", "clair": "blackthorn-city", "lt-surge": "vermilion-city", "sabrina": "kanto-route-6", "erika": "celadon-city", "janine": "kanto-route-12", "misty": "kanto-route-5", "brock": "kanto-route-3", "blaine": "cinnabar-island", "blue": "pallet-town",
    },
    "crystal": {
        "falkner": "sprout-tower", "bugsy": "azalea-town", "whitney": "goldenrod-city",
        "morty": "burned-tower", "chuck": "cianwood-city", "jasmine": "johto-sea-route-41",
        "pryce": "lake-of-rage", "clair": "blackthorn-city", "lt-surge": "vermilion-city", "sabrina": "kanto-route-6", "erika": "celadon-city", "janine": "kanto-route-12", "misty": "kanto-route-5", "brock": "kanto-route-3", "blaine": "cinnabar-island", "blue": "pallet-town",
    },
    "heartgold-soulsilver": {
        "falkner": "sprout-tower", "bugsy": "azalea-town", "whitney": "goldenrod-city",
        "morty": "burned-tower", "chuck": "cianwood-city", "jasmine": "johto-sea-route-41",
        "pryce": "lake-of-rage", "clair": "blackthorn-city", "brock": "pewter-city",
        "misty": "kanto-route-25", "lt-surge": "digletts-cave", "erika": "celadon-city",
        "janine": "kanto-route-12", "sabrina": "saffron-city", "blaine": "seafoam-islands",
        "blue": "kanto-sea-route-21",
    },
    "ruby-sapphire": {
        "roxanne": "rustboro-city", "brawly": "granite-cave", "wattson": "hoenn-route-117",
        "flannery": "lavaridge-town", "norman": "lavaridge-town", "winona": "lilycove-city",
        "tate-and-liza": "mossdeep-city", "wallace": "cave-of-origin", "steven": "hoenn-victory-road",
    },
    "emerald": {
        "roxanne": "rustboro-city", "brawly": "granite-cave", "wattson": "hoenn-route-117",
        "flannery": "lavaridge-town", "norman": "mirage-tower", "winona": "lilycove-city",
        "tate-and-liza": "mossdeep-city", "juan": "sky-pillar", "wallace": "hoenn-victory-road",
    },
    "omega-ruby-alpha-sapphire": {
        "oras-roxanne": "petalburg-woods", "oras-brawly": "granite-cave",
        "oras-wattson": "verdanturf-town", "oras-flannery": "lavaridge-town",
        "oras-norman": "lavaridge-town", "oras-winona": "lilycove-city",
        "oras-tate-and-liza": "mossdeep-city", "oras-wallace": "cave-of-origin", "oras-steven": "hoenn-victory-road",
    },
    "diamond-pearl": {
        "roark": "oreburgh-city", "gardenia": "eterna-city", "maylene": "sinnoh-route-215",
        "crasher-wake": "pastoria-city", "fantina": "celestic-town",
        "byron": "sinnoh-route-211", "candice": "acuity-lakefront", "volkner": "sunyshore-city",
    },
    "platinum": {
        "roark": "oreburgh-city", "gardenia": "eterna-city", "fantina": "hearthome-city",
        "maylene": "veilstone-city", "crasher-wake": "sinnoh-route-212",
        "byron": "canalave-city", "candice": "acuity-lakefront", "volkner": "sunyshore-city",
    },
    "sun-moon": {
        "totem-gumshoos": "verdant-cavern", "kahuna-hala": "kalae-bay",
        "totem-wishiwashi": "brooklet-hill", "totem-salazzle": "wela-volcano-park",
        "totem-lurantis": "lush-jungle", "kahuna-olivia": "memorial-hill",
        "totem-vikavolt": "mount-hokulani", "totem-mimikyu": "thrifty-megamart",
        "kahuna-nanu": "alola-route-17", "kahuna-hapu": "poni-breaker-coast",
        "totem-kommo-o": "vast-poni-canyon",
    },
    "ultra-sun-ultra-moon": {
        "totem-gumshoos": "verdant-cavern", "kahuna-hala": "kalae-bay",
        "totem-araquanid": "brooklet-hill", "totem-marowak": "wela-volcano-park",
        "totem-lurantis": "lush-jungle", "kahuna-olivia": "memorial-hill",
        "totem-togedemaru": "mount-hokulani", "totem-mimikyu": "thrifty-megamart",
        "kahuna-nanu": "alola-route-17", "totem-kommo-o": "vast-poni-canyon",
        "totem-ribombee": "vast-poni-canyon", "kahuna-hapu": "vast-poni-canyon",
        "ultra-necrozma": "vast-poni-canyon",
    },
    "sword-shield": {
        "milo": "turffield", "nessa": "hulbury", "kabu": "galar-mine-no-2",
        "bea": "galar-route-6", "allister": "galar-route-6", "opal": "glimwood-tangle",
        "gordie": "galar-route-8", "melony": "galar-route-8",
        "piers": "lake-of-outrage", "raihan": "lake-of-outrage",
    },
    "x-y": {
        "xy-viola": "kalos-route-22",
        "xy-grant": "cyllage-city",
        "xy-korrina": "shalour-city",
        "xy-ramos": "azure-bay",
        "xy-clemont": "kalos-route-13",
        "xy-valerie": "laverre-city",
        "xy-olympia": "kalos-route-17",
        "xy-wulfric": "pokemon-village",
    },
}

# Not wild/catchable encounters for run-logging purposes (in-game trades,
# raid dens, event distributions, snag battles in side games, island scan).
PHANTOM_AREAS = {"sun-moon": {"new-mauville"}}  # cross-region leak in PokéAPI data, not an Alola area

# Story bosses (rivals, team leaders/admins): display-only, never checkpoints
# or level caps. `order` interleaves with gym bosses' order in the Story tab.
# Rival fights are one entry per player starter choice (same order, so the
# Story tab groups them as variants). Teams are species+level only, from
# public walkthroughs (StrategyWiki, Thonky, Bulbapedia); no moves/items.
# Emerald pilot: rival (5 fights x 3 starters) + Aqua/Magma (Tabitha x3,
# Maxie x3, Shelly x2, Matt x1, Archie x1). Courtney is NOT battled in
# Emerald (cameo only), so she is deliberately excluded.
def _sb(boss_id, name, location, order, team, starter=None):
    boss = {
        "id": boss_id, "name": name, "location": location, "order": order,
        "levelCap": max(lv for _, lv in team),
        "team": [{"species": sp, "level": lv, "ability": None, "item": None, "moves": []}
                 for sp, lv in team],
    }
    if starter:
        boss["starterChoice"] = starter
    return boss

STORY_BOSSES = {
    "emerald": [
        _sb("rival-route-103-treecko", "Rival May/Brendan (you chose Treecko)", "Route 103", 5, [("torchic", 5)], starter="treecko"),
        _sb("rival-route-103-torchic", "Rival May/Brendan (you chose Torchic)", "Route 103", 5, [("mudkip", 5)], starter="torchic"),
        _sb("rival-route-103-mudkip", "Rival May/Brendan (you chose Mudkip)", "Route 103", 5, [("treecko", 5)], starter="mudkip"),
        _sb("rival-rustboro-treecko", "Rival May/Brendan (you chose Treecko)", "Rustboro City", 15, [("lotad", 13), ("torchic", 15)], starter="treecko"),
        _sb("rival-rustboro-torchic", "Rival May/Brendan (you chose Torchic)", "Rustboro City", 15, [("slugma", 13), ("mudkip", 15)], starter="torchic"),
        _sb("rival-rustboro-mudkip", "Rival May/Brendan (you chose Mudkip)", "Rustboro City", 15, [("wingull", 13), ("treecko", 15)], starter="mudkip"),
        _sb("rival-route-110-treecko", "Rival May/Brendan (you chose Treecko)", "Route 110", 25, [("wingull", 18), ("lombre", 18), ("combusken", 20)], starter="treecko"),
        _sb("rival-route-110-torchic", "Rival May/Brendan (you chose Torchic)", "Route 110", 25, [("lombre", 18), ("slugma", 18), ("marshtomp", 20)], starter="torchic"),
        _sb("rival-route-110-mudkip", "Rival May/Brendan (you chose Mudkip)", "Route 110", 25, [("slugma", 18), ("wingull", 18), ("grovyle", 20)], starter="mudkip"),
        _sb("tabitha-mt-chimney", "Tabitha (Team Magma)", "Mt. Chimney", 35, [("numel", 18), ("poochyena", 20), ("numel", 22), ("zubat", 22)]),
        _sb("maxie-mt-chimney", "Maxie (Team Magma)", "Mt. Chimney", 36, [("mightyena", 24), ("zubat", 24), ("camerupt", 25)]),
        _sb("shelly-weather-institute", "Shelly (Team Aqua)", "Weather Institute", 55, [("carvanha", 28), ("mightyena", 28)]),
        _sb("rival-route-119-treecko", "Rival May/Brendan (you chose Treecko)", "Route 119", 56, [("lombre", 29), ("wingull", 29), ("combusken", 31)], starter="treecko"),
        _sb("rival-route-119-torchic", "Rival May/Brendan (you chose Torchic)", "Route 119", 56, [("lombre", 29), ("slugma", 29), ("marshtomp", 31)], starter="torchic"),
        _sb("rival-route-119-mudkip", "Rival May/Brendan (you chose Mudkip)", "Route 119", 56, [("slugma", 29), ("wingull", 29), ("grovyle", 31)], starter="mudkip"),
        _sb("rival-lilycove-treecko", "Rival May/Brendan (you chose Treecko)", "Lilycove City", 63, [("tropius", 31), ("ludicolo", 32), ("pelipper", 32), ("combusken", 34)], starter="treecko"),
        _sb("rival-lilycove-torchic", "Rival May/Brendan (you chose Torchic)", "Lilycove City", 63, [("tropius", 31), ("ludicolo", 32), ("slugma", 32), ("marshtomp", 34)], starter="torchic"),
        _sb("rival-lilycove-mudkip", "Rival May/Brendan (you chose Mudkip)", "Lilycove City", 63, [("tropius", 31), ("pelipper", 32), ("slugma", 32), ("grovyle", 34)], starter="mudkip"),
        _sb("tabitha-magma-hideout", "Tabitha (Team Magma)", "Magma Hideout (Mt. Chimney)", 65, [("numel", 26), ("mightyena", 28), ("zubat", 30), ("camerupt", 33)]),
        _sb("maxie-magma-hideout", "Maxie (Team Magma)", "Magma Hideout (Mt. Chimney)", 66, [("mightyena", 37), ("crobat", 38), ("camerupt", 39)]),
        _sb("matt-aqua-hideout", "Matt (Team Aqua)", "Aqua Hideout (Lilycove)", 67, [("mightyena", 34), ("golbat", 34)]),
        _sb("maxie-space-center", "Maxie (Team Magma)", "Mossdeep Space Center (double battle with Steven)", 73, [("mightyena", 42), ("crobat", 43), ("camerupt", 44)]),
        _sb("tabitha-space-center", "Tabitha (Team Magma)", "Mossdeep Space Center (double battle with Steven)", 73, [("camerupt", 36), ("mightyena", 38), ("golbat", 40)]),
        _sb("shelly-seafloor", "Shelly (Team Aqua)", "Seafloor Cavern", 76, [("sharpedo", 37), ("mightyena", 37)]),
        _sb("archie-seafloor", "Archie (Team Aqua)", "Seafloor Cavern", 77, [("mightyena", 41), ("crobat", 41), ("sharpedo", 43)]),
        # Wally: Mauville (Ralts only) + the first Victory Road fight.
        # Post-Elite Four rematches scale up (up to Gardevoir 57) and are
        # deliberately not listed — this is the story fight only.
        _sb("wally-mauville", "Wally", "Mauville City", 28, [("ralts", 16)]),
        _sb("wally-victory-road", "Wally", "Victory Road", 85, [("magneton", 41), ("delcatty", 43), ("altaria", 44), ("roselia", 44), ("gardevoir", 45)]),
    ],
}
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
            if pack_id in PHANTOM_AREAS:
                sorted_locs = [loc for loc in sorted_locs if location_ident.get(loc) not in PHANTOM_AREAS[pack_id]]
            # Story-progression chains: level heuristics still misplace
            # areas that unlock via HMs or events, so packs with a chain
            # get their main route pinned to the order the game actually
            # unfolds (each entry placed immediately after the previous).
            # Unlisted areas keep their heuristic positions.
            STORY_CHAINS = {
                "black-white": ['nuvema-town', 'unova-route-1', 'unova-route-2', 'striaton-city', 'dreamyard', 'unova-route-3', 'wellspring-cave', 'nacrene-city', 'pinwheel-forest', 'castelia-city', 'liberty-garden', 'unova-route-4', 'desert-resort', 'relic-castle', 'unova-route-16', 'lostlorn-forest', 'unova-route-5', 'driftveil-drawbridge', 'driftveil-city', 'cold-storage', 'unova-route-6', 'chargestone-cave', 'unova-route-7', 'celestial-tower', 'unova-route-17', 'unova-route-18', 'p2-laboratory', 'mistralton-cave', 'guidance-chamber', 'twist-mountain', 'icirrus-city', 'dragonspiral-tower', 'unova-route-8', 'moor-of-icirrus', 'unova-route-9', 'unova-route-10', 'unova-victory-road', 'trial-chamber', 'unova-route-11', 'village-bridge', 'unova-route-12', 'unova-route-13', 'undella-town', 'undella-bay', 'unova-route-14', 'abundant-shrine', 'unova-route-15', 'marvelous-bridge', 'giant-chasm', 'challengers-cave'],
                "x-y": [
                    "aquacorde-town", "kalos-route-2", "santalune-forest", "kalos-route-3",
                    "kalos-route-22", "kalos-route-4", "lumiose-city", "kalos-route-5",
                    "kalos-berry-fields", "kalos-route-6", "parfum-palace", "kalos-route-7",
                    "connecting-cave", "kalos-route-8", "ambrette-town", "kalos-route-9",
                    "glittering-cave", "cyllage-city", "kalos-route-10", "kalos-route-11",
                    "reflection-cave", "shalour-city", "tower-of-mastery", "kalos-route-12",
                    "azure-bay", "kalos-route-13", "kalos-route-14", "laverre-city",
                    "kalos-route-15", "kalos-route-16", "lost-hotel", "frost-cavern",
                    "kalos-route-17", "kalos-route-18", "terminus-cave", "couriway-town",
                    "kalos-route-19", "kalos-route-20", "pokemon-village", "kalos-route-21",
                    "kalos-victory-road", "friend-safari",
                ],
                "red-blue": ['pallet-town', 'kanto-route-1', 'viridian-city', 'kanto-route-2', 'viridian-forest', 'kanto-route-3', 'mt-moon', 'kanto-route-4', 'cerulean-city', 'kanto-route-24', 'kanto-route-25', 'kanto-route-5', 'kanto-route-6', 'vermilion-city', 'kanto-route-11', 'digletts-cave', 'kanto-route-9', 'kanto-route-10', 'rock-tunnel', 'kanto-route-8', 'kanto-route-7', 'celadon-city', 'kanto-route-16', 'kanto-route-17', 'kanto-route-18', 'fuchsia-city', 'kanto-safari-zone', 'kanto-route-15', 'kanto-route-14', 'kanto-route-13', 'kanto-route-12', 'pokemon-tower', 'saffron-city', 'kanto-sea-route-19', 'kanto-sea-route-20', 'seafoam-islands', 'cinnabar-island', 'pokemon-mansion', 'kanto-power-plant', 'kanto-sea-route-21', 'kanto-route-22', 'kanto-route-23', 'kanto-victory-road-2', 'cerulean-cave'],
                "yellow": ['pallet-town', 'kanto-route-1', 'viridian-city', 'kanto-route-2', 'viridian-forest', 'kanto-route-3', 'mt-moon', 'kanto-route-4', 'cerulean-city', 'kanto-route-24', 'kanto-route-25', 'kanto-route-5', 'kanto-route-6', 'vermilion-city', 'kanto-route-11', 'digletts-cave', 'kanto-route-9', 'kanto-route-10', 'rock-tunnel', 'kanto-route-8', 'kanto-route-7', 'celadon-city', 'kanto-route-16', 'kanto-route-17', 'kanto-route-18', 'fuchsia-city', 'kanto-safari-zone', 'kanto-route-15', 'kanto-route-14', 'kanto-route-13', 'kanto-route-12', 'pokemon-tower', 'saffron-city', 'kanto-sea-route-19', 'kanto-sea-route-20', 'seafoam-islands', 'cinnabar-island', 'pokemon-mansion', 'kanto-power-plant', 'kanto-sea-route-21', 'kanto-route-22', 'kanto-route-23', 'kanto-victory-road-2', 'cerulean-cave'],
                "gold-silver": ['new-bark-town', 'johto-route-29', 'cherrygrove-city', 'johto-route-30', 'johto-route-31', 'dark-cave', 'violet-city', 'sprout-tower', 'johto-route-32', 'union-cave', 'ruins-of-alph', 'johto-route-33', 'slowpoke-well', 'azalea-town', 'ilex-forest', 'johto-route-34', 'goldenrod-city', 'johto-route-35', 'national-park', 'johto-route-36', 'johto-route-37', 'ecruteak-city', 'bell-tower', 'burned-tower', 'johto-route-38', 'johto-route-39', 'olivine-city', 'johto-sea-route-40', 'cianwood-city', 'johto-route-47', 'johto-route-48', 'safari-zone-gate', 'johto-safari-zone', 'johto-sea-route-41', 'whirl-islands', 'johto-route-42', 'mt-mortar', 'team-rocket-hq', 'johto-route-43', 'lake-of-rage', 'johto-route-44', 'ice-path', 'blackthorn-city', 'dragons-den', 'johto-route-45', 'johto-route-46', 'tohjo-falls', 'kanto-route-27', 'kanto-route-26', 'kanto-victory-road-1', 'vermilion-city', 'kanto-route-6', 'kanto-route-7', 'celadon-city', 'kanto-route-16', 'kanto-route-17', 'kanto-route-18', 'fuchsia-city', 'kanto-route-15', 'kanto-route-14', 'kanto-route-13', 'kanto-route-12', 'kanto-route-8', 'rock-tunnel', 'kanto-route-10', 'kanto-route-9', 'cerulean-city', 'kanto-route-24', 'kanto-route-25', 'kanto-route-5', 'kanto-route-4', 'mt-moon', 'kanto-route-3', 'kanto-route-2', 'digletts-cave', 'kanto-route-11', 'kanto-sea-route-19', 'kanto-sea-route-20', 'cinnabar-island', 'kanto-sea-route-21', 'viridian-city', 'kanto-route-22', 'kanto-route-1', 'pallet-town', 'kanto-route-28', 'mt-silver', 'roaming-johto'],
                "crystal": ['new-bark-town', 'johto-route-29', 'cherrygrove-city', 'johto-route-30', 'johto-route-31', 'dark-cave', 'violet-city', 'sprout-tower', 'johto-route-32', 'union-cave', 'ruins-of-alph', 'johto-route-33', 'slowpoke-well', 'azalea-town', 'ilex-forest', 'johto-route-34', 'goldenrod-city', 'johto-route-35', 'national-park', 'johto-route-36', 'johto-route-37', 'ecruteak-city', 'bell-tower', 'burned-tower', 'johto-route-38', 'johto-route-39', 'olivine-city', 'johto-sea-route-40', 'cianwood-city', 'johto-route-47', 'johto-route-48', 'safari-zone-gate', 'johto-safari-zone', 'johto-sea-route-41', 'whirl-islands', 'johto-route-42', 'mt-mortar', 'team-rocket-hq', 'johto-route-43', 'lake-of-rage', 'johto-route-44', 'ice-path', 'blackthorn-city', 'dragons-den', 'johto-route-45', 'johto-route-46', 'tohjo-falls', 'kanto-route-27', 'kanto-route-26', 'kanto-victory-road-1', 'vermilion-city', 'kanto-route-6', 'kanto-route-7', 'celadon-city', 'kanto-route-16', 'kanto-route-17', 'kanto-route-18', 'fuchsia-city', 'kanto-route-15', 'kanto-route-14', 'kanto-route-13', 'kanto-route-12', 'kanto-route-8', 'rock-tunnel', 'kanto-route-10', 'kanto-route-9', 'cerulean-city', 'kanto-route-24', 'kanto-route-25', 'kanto-route-5', 'kanto-route-4', 'mt-moon', 'kanto-route-3', 'kanto-route-2', 'digletts-cave', 'kanto-route-11', 'kanto-sea-route-19', 'kanto-sea-route-20', 'cinnabar-island', 'kanto-sea-route-21', 'viridian-city', 'kanto-route-22', 'kanto-route-1', 'pallet-town', 'kanto-route-28', 'mt-silver', 'roaming-johto'],
                "heartgold-soulsilver": ['new-bark-town', 'johto-route-29', 'cherrygrove-city', 'johto-route-30', 'johto-route-31', 'dark-cave', 'violet-city', 'sprout-tower', 'johto-route-32', 'union-cave', 'ruins-of-alph', 'johto-route-33', 'slowpoke-well', 'azalea-town', 'ilex-forest', 'johto-route-34', 'goldenrod-city', 'johto-route-35', 'national-park', 'johto-route-36', 'johto-route-37', 'ecruteak-city', 'bell-tower', 'burned-tower', 'johto-route-38', 'johto-route-39', 'olivine-city', 'johto-sea-route-40', 'cianwood-city', 'johto-route-47', 'johto-route-48', 'safari-zone-gate', 'johto-safari-zone', 'johto-sea-route-41', 'whirl-islands', 'johto-route-42', 'mt-mortar', 'team-rocket-hq', 'johto-route-43', 'lake-of-rage', 'johto-route-44', 'ice-path', 'blackthorn-city', 'dragons-den', 'johto-route-45', 'johto-route-46', 'tohjo-falls', 'kanto-route-27', 'kanto-route-26', 'kanto-victory-road-1', 'pallet-town', 'kanto-route-1', 'viridian-city', 'kanto-route-22', 'kanto-route-2', 'viridian-forest', 'pewter-city', 'kanto-route-3', 'mt-moon', 'kanto-route-4', 'cerulean-city', 'kanto-route-24', 'kanto-route-25', 'kanto-route-5', 'kanto-route-6', 'vermilion-city', 'kanto-route-11', 'digletts-cave', 'kanto-route-9', 'kanto-route-10', 'rock-tunnel', 'kanto-route-8', 'kanto-route-7', 'celadon-city', 'kanto-route-16', 'kanto-route-17', 'kanto-route-18', 'fuchsia-city', 'kanto-route-15', 'kanto-route-14', 'kanto-route-13', 'kanto-route-12', 'saffron-city', 'kanto-sea-route-19', 'kanto-sea-route-20', 'seafoam-islands', 'cinnabar-island', 'kanto-sea-route-21', 'kanto-route-28', 'mt-silver', 'roaming-johto', 'cerulean-cave', 'unknown-all-bugs', 'unknown-all-rattata', 'unknown-all-poliwag'],
                "ruby-sapphire": ['littleroot-town', 'hoenn-route-101', 'hoenn-route-103', 'hoenn-route-102', 'petalburg-city', 'hoenn-route-104', 'petalburg-woods', 'rustboro-city', 'hoenn-route-116', 'rusturf-tunnel', 'hoenn-route-106', 'dewford-town', 'granite-cave', 'hoenn-route-109', 'slateport-city', 'hoenn-route-110', 'hoenn-route-117', 'hoenn-route-111', 'fiery-path', 'hoenn-route-112', 'hoenn-route-113', 'fallarbor-town', 'hoenn-route-114', 'meteor-falls', 'hoenn-route-115', 'jagged-pass', 'lavaridge-town', 'hoenn-route-105', 'hoenn-route-107', 'hoenn-route-108', 'abandoned-ship', 'new-mauville', 'hoenn-route-118', 'hoenn-route-119', 'hoenn-route-120', 'hoenn-route-121', 'hoenn-safari-zone', 'lilycove-city', 'hoenn-route-122', 'mt-pyre', 'hoenn-route-123', 'team-aqua-hideout', 'team-magma-hideout', 'magma-hideout', 'hoenn-route-124', 'hoenn-route-125', 'shoal-cave', 'mossdeep-city', 'hoenn-route-127', 'hoenn-route-128', 'seafloor-cavern', 'sootopolis-city', 'cave-of-origin', 'hoenn-route-129', 'hoenn-route-130', 'pacifidlog-town', 'hoenn-route-131', 'hoenn-route-132', 'hoenn-route-133', 'hoenn-route-134', 'hoenn-route-126', 'ever-grande-city', 'hoenn-victory-road', 'sky-pillar', 'mirage-island', 'roaming-hoenn'],
                "emerald": ['littleroot-town', 'hoenn-route-101', 'hoenn-route-103', 'hoenn-route-102', 'petalburg-city', 'hoenn-route-104', 'petalburg-woods', 'rustboro-city', 'hoenn-route-116', 'rusturf-tunnel', 'hoenn-route-106', 'dewford-town', 'granite-cave', 'hoenn-route-109', 'slateport-city', 'hoenn-route-110', 'hoenn-route-117', 'hoenn-route-111', 'fiery-path', 'hoenn-route-112', 'hoenn-route-113', 'fallarbor-town', 'hoenn-route-114', 'meteor-falls', 'hoenn-route-115', 'jagged-pass', 'lavaridge-town', 'mirage-tower', 'hoenn-route-105', 'hoenn-route-107', 'hoenn-route-108', 'abandoned-ship', 'new-mauville', 'hoenn-route-118', 'hoenn-route-119', 'hoenn-route-120', 'hoenn-route-121', 'hoenn-safari-zone', 'lilycove-city', 'hoenn-route-122', 'mt-pyre', 'hoenn-route-123', 'magma-hideout', 'team-aqua-hideout', 'team-magma-hideout', 'hoenn-route-124', 'hoenn-route-125', 'shoal-cave', 'mossdeep-city', 'hoenn-route-127', 'hoenn-route-128', 'seafloor-cavern', 'sootopolis-city', 'cave-of-origin', 'hoenn-route-129', 'hoenn-route-130', 'pacifidlog-town', 'hoenn-route-131', 'hoenn-route-132', 'hoenn-route-133', 'hoenn-route-134', 'sky-pillar', 'hoenn-route-126', 'ever-grande-city', 'hoenn-victory-road', 'mirage-island', 'hoenn-battle-frontier', 'birth-island', 'faraway-island', 'desert-underpass', 'hoenn-altering-cave', 'roaming-hoenn', 'artisan-cave'],
                "omega-ruby-alpha-sapphire": ['hoenn-route-101', 'hoenn-route-103', 'hoenn-route-102', 'hoenn-route-104', 'petalburg-woods', 'hoenn-route-116', 'rusturf-tunnel', 'granite-cave', 'slateport-city', 'hoenn-route-110', 'hoenn-route-117', 'verdanturf-town', 'hoenn-route-111', 'fiery-path', 'hoenn-route-112', 'hoenn-route-113', 'fallarbor-town', 'hoenn-route-114', 'meteor-falls', 'hoenn-route-115', 'jagged-pass', 'lavaridge-town', 'new-mauville', 'hoenn-route-118', 'southern-island', 'hoenn-route-119', 'hoenn-route-120', 'scorched-slab', 'hoenn-route-121', 'hoenn-safari-zone', 'lilycove-city', 'mt-pyre', 'hoenn-route-123', 'team-aqua-hideout', 'team-magma-hideout', 'shoal-cave', 'mossdeep-city', 'seafloor-cavern', 'cave-of-origin', 'hoenn-victory-road', 'sky-pillar', 'sea-mauville', 'mossdeep-space-center', 'mirage-spot-cave', 'mirage-spot-forest', 'mirage-spot-island', 'mirage-spot-mountain', 'battle-resort'],
                "firered-leafgreen": ['pallet-town', 'kanto-route-1', 'viridian-city', 'kanto-route-2', 'viridian-forest', 'kanto-route-3', 'mt-moon', 'kanto-route-4', 'cerulean-city', 'kanto-route-24', 'kanto-route-25', 'kanto-route-5', 'kanto-route-6', 'vermilion-city', 'ss-anne', 'kanto-route-11', 'digletts-cave', 'kanto-route-9', 'kanto-route-10', 'rock-tunnel', 'kanto-route-8', 'kanto-route-7', 'celadon-city', 'kanto-route-16', 'kanto-route-17', 'kanto-route-18', 'fuchsia-city', 'kanto-safari-zone', 'kanto-route-15', 'kanto-route-14', 'kanto-route-13', 'kanto-route-12', 'pokemon-tower', 'saffron-city', 'kanto-sea-route-19', 'kanto-sea-route-20', 'seafoam-islands', 'cinnabar-island', 'pokemon-mansion', 'one-island', 'kindle-road', 'mt-ember', 'treasure-beach', 'cape-brink', 'three-isle-port', 'bond-bridge', 'berry-forest', 'kanto-sea-route-21', 'kanto-power-plant', 'kanto-route-22', 'kanto-route-23', 'kanto-victory-road-2', 'four-island', 'icefall-cave', 'green-path', 'water-path', 'pattern-bush', 'outcast-island', 'kanto-altering-cave', 'ruin-valley', 'five-island', 'five-isle-meadow', 'memorial-pillar', 'resort-gorgeous', 'water-labyrinth', 'lost-cave', 'canyon-entrance', 'sevault-canyon', 'tanoby-ruins', 'dilford-chamber', 'liptoo-chamber', 'monean-chamber', 'rixy-chamber', 'scufib-chamber', 'viapos-chamber', 'weepth-chamber', 'trainer-tower', 'cerulean-cave', 'birth-island', 'roaming-kanto'],
                "lets-go": ['pallet-town', 'kanto-route-1', 'kanto-route-2', 'viridian-forest', 'kanto-route-3', 'mt-moon', 'kanto-route-4', 'cerulean-city', 'kanto-route-24', 'kanto-route-25', 'kanto-route-5', 'kanto-route-6', 'vermilion-city', 'kanto-route-11', 'digletts-cave', 'kanto-route-9', 'kanto-route-10', 'kanto-power-plant', 'rock-tunnel', 'kanto-route-8', 'kanto-route-7', 'kanto-route-16', 'kanto-route-17', 'kanto-route-18', 'kanto-route-15', 'kanto-route-14', 'kanto-route-13', 'kanto-route-12', 'pokemon-tower', 'saffron-city', 'kanto-sea-route-19', 'kanto-sea-route-20', 'seafoam-islands', 'cinnabar-island', 'pokemon-mansion', 'kanto-sea-route-21', 'kanto-route-22', 'kanto-route-23', 'kanto-victory-road-1', 'cerulean-cave'],
                "diamond-pearl": ['twinleaf-town', 'sinnoh-route-201', 'lake-verity', 'sinnoh-route-202', 'sinnoh-route-203', 'oreburgh-gate', 'oreburgh-mine', 'oreburgh-city', 'sinnoh-route-204', 'ravaged-path', 'floaroma-meadow', 'sinnoh-route-205', 'valley-windworks', 'eterna-forest', 'old-chateau', 'eterna-city', 'sinnoh-route-206', 'wayward-cave', 'sinnoh-route-207', 'mt-coronet', 'sinnoh-route-208', 'hearthome-city', 'sinnoh-route-209', 'solaceon-ruins', 'trophy-garden', 'lost-tower', 'sinnoh-route-210', 'sinnoh-route-215', 'sinnoh-route-214', 'ruin-maniac-cave', 'valor-lakefront', 'lake-valor', 'sinnoh-route-213', 'pastoria-city', 'great-marsh', 'sinnoh-route-212', 'celestic-town', 'sinnoh-route-218', 'canalave-city', 'iron-island', 'sinnoh-route-219', 'sinnoh-sea-route-220', 'sinnoh-route-221', 'fuego-ironworks', 'sinnoh-route-211', 'sinnoh-route-216', 'sinnoh-route-217', 'acuity-lakefront', 'lake-acuity', 'sinnoh-route-222', 'sunyshore-city', 'sinnoh-sea-route-223', 'sinnoh-victory-road', 'sinnoh-pokemon-league', 'sinnoh-route-224', 'sinnoh-route-225', 'sinnoh-sea-route-226', 'sinnoh-route-227', 'stark-mountain', 'sinnoh-route-228', 'sinnoh-route-229', 'sinnoh-sea-route-230', 'resort-area', 'flower-paradise', 'maniac-tunnel', 'sendoff-spring', 'turnback-cave', 'snowpoint-temple', 'newmoon-island', 'sinnoh-hall-of-origin-1', 'roaming-sinnoh'],
                "platinum": ['twinleaf-town', 'sinnoh-route-201', 'lake-verity', 'sinnoh-route-202', 'sinnoh-route-203', 'oreburgh-gate', 'oreburgh-mine', 'oreburgh-city', 'sinnoh-route-204', 'ravaged-path', 'floaroma-meadow', 'sinnoh-route-205', 'valley-windworks', 'eterna-forest', 'old-chateau', 'eterna-city', 'sinnoh-route-206', 'wayward-cave', 'sinnoh-route-207', 'mt-coronet', 'sinnoh-route-208', 'hearthome-city', 'sinnoh-route-209', 'solaceon-ruins', 'trophy-garden', 'lost-tower', 'sinnoh-route-210', 'sinnoh-route-215', 'veilstone-city', 'sinnoh-route-214', 'ruin-maniac-cave', 'valor-lakefront', 'lake-valor', 'sinnoh-route-213', 'pastoria-city', 'great-marsh', 'sinnoh-route-212', 'celestic-town', 'fuego-ironworks', 'sinnoh-route-219', 'sinnoh-sea-route-220', 'sinnoh-route-221', 'sinnoh-route-218', 'canalave-city', 'iron-island', 'sinnoh-route-211', 'sinnoh-route-216', 'sinnoh-route-217', 'acuity-lakefront', 'lake-acuity', 'sendoff-spring', 'sinnoh-route-222', 'sunyshore-city', 'sinnoh-sea-route-223', 'sinnoh-victory-road', 'sinnoh-pokemon-league', 'sinnoh-route-224', 'sinnoh-route-225', 'sinnoh-sea-route-226', 'sinnoh-route-227', 'stark-mountain', 'sinnoh-route-228', 'sinnoh-route-229', 'sinnoh-sea-route-230', 'resort-area', 'flower-paradise', 'maniac-tunnel', 'turnback-cave', 'snowpoint-temple', 'newmoon-island', 'sinnoh-hall-of-origin-1', 'roaming-sinnoh'],
                "black-2-white-2": ['aspertia-city', 'unova-route-19', 'floccesy-town', 'unova-route-20', 'floccesy-ranch', 'virbank-city', 'virbank-complex', 'castelia-city', 'castelia-sewers', 'relic-passage', 'unova-route-4', 'desert-resort', 'relic-castle', 'unova-route-16', 'lostlorn-forest', 'unova-route-5', 'driftveil-drawbridge', 'driftveil-city', 'unova-route-6', 'mistralton-cave', 'guidance-chamber', 'chargestone-cave', 'unova-route-7', 'celestial-tower', 'strange-house', 'reversal-mountain', 'undella-town', 'undella-bay', 'unova-route-13', 'unova-route-12', 'village-bridge', 'unova-route-11', 'unova-route-9', 'unova-route-21', 'seaside-cave', 'humilau-city', 'unova-route-22', 'giant-chasm', 'unova-route-23', 'unova-victory-road-2', 'unova-victory-road', 'clay-tunnel', 'underground-ruins', 'glacier-room', 'iron-room', 'rocky-mountain-room', 'unova-route-14', 'abundant-shrine', 'unova-route-15', 'marvelous-bridge', 'twist-mountain', 'icirrus-city', 'unova-route-8', 'moor-of-icirrus', 'dragonspiral-tower', 'pinwheel-forest', 'nacrene-city', 'unova-route-3', 'wellspring-cave', 'striaton-city', 'dreamyard', 'unova-route-2', 'unova-route-1', 'unova-route-17', 'unova-route-18', 'p2-laboratory', 'nature-sanctuary'],
                "sun-moon": ['alola-route-1', 'iki-town', 'hauoli-city', 'alola-route-2', 'hauoli-cemetery', 'alola-berry-fields', 'verdant-cavern', 'alola-route-3', 'melemele-meadow', 'seaward-cave', 'kalae-bay', 'ten-carat-hill', 'alola-route-4', 'paniola-town', 'paniola-ranch', 'alola-route-5', 'melemele-sea', 'brooklet-hill', 'alola-route-6', 'alola-route-7', 'wela-volcano-park', 'alola-route-8', 'akala-outskirts', 'lush-jungle', 'digletts-tunnel', 'alola-route-9', 'memorial-hill', 'hano-beach', 'malie-city', 'malie-garden', 'alola-route-10', 'mount-hokulani', 'alola-route-11', 'alola-route-12', 'blush-mountain', 'secluded-shore', 'alola-route-13', 'tapu-village', 'alola-route-14', 'thrifty-megamart', 'haina-desert', 'alola-route-15', 'alola-route-16', 'ulaula-meadow', 'lake-of-the-moone', 'lake-of-the-sunne', 'alola-route-17', 'seafolk-village', 'exeggutor-island', 'poni-wilds', 'ancient-poni-path', 'poni-breaker-coast', 'vast-poni-canyon', 'mount-lanakila', 'poni-grove', 'poni-meadow', 'poni-plains', 'resolution-cave', 'poni-coast', 'poni-gauntlet', 'aether-paradise', 'poke-pelago', 'verdant-cavern--trial-site'],
                "ultra-sun-ultra-moon": ['alola-route-1', 'mahalo-trail', 'trainers-school', 'hauoli-city', 'hauoli-cemetery', 'sandy-cave', 'alola-route-2', 'verdant-cavern', 'alola-berry-fields', 'alola-route-3', 'seaward-cave', 'melemele-meadow', 'kalae-bay', 'ten-carat-hill', 'heahea-beach', 'heahea-city', 'alola-route-4', 'paniola-town', 'paniola-ranch', 'alola-route-5', 'melemele-sea', 'brooklet-hill', 'alola-route-6', 'alola-route-7', 'dividing-peak-tunnel', 'wela-volcano-park', 'alola-route-8', 'akala-outskirts', 'lush-jungle', 'digletts-tunnel', 'alola-route-9', 'konikoni-city', 'memorial-hill', 'hano-beach', 'malie-city', 'malie-garden', 'alola-route-10', 'mount-hokulani', 'alola-route-11', 'alola-route-12', 'blush-mountain', 'ulaula-beach', 'alola-route-13', 'tapu-village', 'alola-route-14', 'thrifty-megamart', 'haina-desert', 'alola-route-15', 'alola-route-16', 'ulaula-meadow', 'lake-of-the-moone', 'lake-of-the-sunne', 'alola-route-17', 'seafolk-village', 'poni-wilds', 'ancient-poni-path', 'poni-breaker-coast', 'exeggutor-island', 'vast-poni-canyon', 'mount-lanakila', 'poni-grove', 'poni-meadow', 'poni-plains', 'resolution-cave', 'poni-coast', 'poni-gauntlet', 'poke-pelago', 'ultra-megalopolis', 'team-rockets-castle', 'ultra-space', 'ultra-space-wilds'],
                "sword-shield": ['postwick', 'galar-route-1', 'slumbering-weald', 'wedgehurst', 'galar-route-2', 'rolling-fields', 'meetup-spot', 'dappled-grove', 'watchtower-ruins', 'east-lake-axewell', 'west-lake-axewell', 'south-lake-miloch', 'north-lake-miloch', 'giants-cap', 'giants-mirror', 'bridge-field', 'motostoke-riverbank', 'stony-wilderness', 'dusty-bowl', 'hammerlocke-hills', 'giants-seat', 'motostoke-outskirts', 'motostoke', 'galar-route-3', 'galar-mine', 'galar-route-4', 'turffield', 'galar-route-5', 'hulbury', 'galar-mine-no-2', 'galar-route-6', 'glimwood-tangle', 'galar-route-7', 'galar-route-8', 'galar-route-9', 'axews-eye', 'lake-of-outrage', 'galar-route-10', 'galar-battle-tower'],
            }
            chain = STORY_CHAINS.get(pack_id, [])
            if chain:
                # Sequential placement: take every chain entry that exists
                # in this pack, in chain order, and make them a contiguous
                # prefix. Pairwise "place after previous" breaks when an
                # intermediate chain entry is absent from a pack (a city
                # with no wild encounters), leaving everything after the
                # gap stranded in its heuristic position.
                chain_locs = []
                for area_ident in chain:
                    loc = next(
                        (l for l in sorted_locs if location_ident.get(l) == area_ident), None
                    )
                    if loc is not None and loc not in chain_locs:
                        chain_locs.append(loc)
                for loc in chain_locs:
                    sorted_locs.remove(loc)
                for i, loc in enumerate(chain_locs):
                    sorted_locs.insert(i, loc)
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
        if pack_id in SEGMENT_CUTOFFS:
            pack["bossAreaCutoffs"] = SEGMENT_CUTOFFS[pack_id]
        if pack_id in STORY_BOSSES:
            pack["storyBosses"] = STORY_BOSSES[pack_id]
        if pack_id in STORY_BOSSES:
            pack["storyBosses"] = STORY_BOSSES[pack_id]
        out = OUT_DIR / f"{pack_id}.json"
        out.write_text(json.dumps(pack, indent=1, ensure_ascii=False) + "\n")
        n_enc = sum(len(a["encounters"]) for a in areas)
        print(f"{pack_id:38s} areas={len(areas):4d} encounters={n_enc:5d} bosses={len(bosses):3d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
