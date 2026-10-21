# RunBook — Pokémon Run Logger (Losig_pokeTrack)

A run logger for Pokémon **ROM hacks and mainline base games**, with boss preparation built on top of your logged run.

ROM hacks are where trackers fall down: boss teams, encounter tables, level caps, and even Pokémon stats differ per hack, and the data lives in community documentation. RunBook's answer is a **game-pack architecture**: the app engine is game-agnostic, and each game is a single versioned JSON data file (areas, encounter pools, boss teams, per-hack overrides). Adding a game is a data contribution, not new code — which is how the mainline games slotted in alongside the hacks.

## Features

- **25 game packs**: 22 mainline base games (every generation, paired versions combined) + 3 ROM hacks, in a grouped, searchable picker
- **Run logging** for three rulesets: casual playthrough, Nuzlocke, and Hardcore Nuzlocke (level-cap warnings)
- **Timeline view**: encounters grouped into the segment leading up to each boss, with a boss checkpoint card at the end of each segment — so you see everything you can catch before a fight, in order
- **Encounter log** per area with dupes-clause flagging — plus **custom areas**: add your own area + species list when a pack has no table for a place (the **+** button in the timeline)
- **Party / Box / Graveyard** roster management with a by-typing team coverage report (including "uncovered threats"), plus a per-Pokémon **IV checker**: enter its nature, the stats the game shows, and any EVs — the IV for each stat is solved live (a range at low levels, exact as it grows)
- **Boss tracking, cap-first**: boss cards show the level cap up front; click a boss's name to reveal its team only when you want it. Defeat progress across the whole game
- **Boss Prep tab**: pick a boss and get a counter scan of your actual party + box — per boss Pokémon: your **checks** (resist + hit super-effectively), **walls**, who **outspeeds**, and **trap picks** (look great on type, fold to the boss's STAB or a recorded coverage move), a **threat list** for boss mons nothing resists (ace called out), catch suggestions from the areas leading up to the fight, a suggested lead, and an auto-generated **prep checklist** (level-cap status, box swaps, gaps). Matchups are typing + speed at level (IV 15, neutral); damage calculation is planned v2
- **Local-first**: runs persist in your browser (localStorage); no account, no backend. **Export/Import backup** (JSON) is on the My runs panel — the data lives in your browser, so it survives the dev server stopping, but it is per-browser/per-origin: use the backup to move runs or keep them safe
- Desktop-first UI (phone pass planned); black-first neon theme (purple/blue/pink highlights, green reserved for success states). The home screen shows your runs first, then collapsible game categories — base games grouped by generation

## Roadmap

- **Phase 2 — Boss prep**: counter scan of your party + box against a boss team (matchups, speed tiers, trap picks, threat list, prep checklist)
- **Phase 3 — More packs**: Inclement Emerald, Emerald Kaizo, Run & Bun, Drayano hacks, story hacks (Gaia, Prism, …), and fan games (Reborn, Insurgence) — 20 games targeted
- **Phase 4 — Polish**: run summary share cards, JSON run export/import, damage calculator evaluation

## Game packs

**Base games (22):** Red & Blue, Yellow, Gold & Silver, Crystal, Ruby & Sapphire, Emerald, FireRed & LeafGreen, Diamond & Pearl, Platinum, HeartGold & SoulSilver, Black & White, Black 2 & White 2, X & Y, Omega Ruby & Alpha Sapphire, Sun & Moon, Ultra Sun & Ultra Moon, Let's Go, Sword & Shield, Brilliant Diamond & Shining Pearl, Legends: Arceus, Scarlet & Violet, Legends: Z-A. Encounter pools are generated from [PokéAPI](https://pokeapi.co)'s published data tables by `scripts/build_base_packs.py` (location-level, trades/raid/event entries excluded; PokéAPI has no encounter tables for BDSP, Legends: Arceus, or the Gen IX games — those packs are boss-data + custom areas for now). Boss teams are community-documented (Bulbapedia, Serebii, and guides — sources recorded inside each pack), species + level only; starter-dependent and version-exclusive variants are described in each pack's notes rather than silently picked.

**ROM hack launch packs:** **Radical Red**, **Unbound**, **Renegade Platinum**, sourced from each hack's public documentation (recorded inside each pack file) and labelled with a data-quality level. More hacks are listed as planned in `src/data/packs/index.ts`.

Want to contribute a pack? A pack is one JSON file matching the schema in `src/engine/types.ts`, validated by `validatePack` in `src/engine/pack.ts` (covered by tests). Open a PR with the file and its sources.

## Development

```bash
npm install
npm run dev     # local dev server
npm test        # engine unit tests (vitest)
npm run build   # type-check + production build
```

Species data (stats, types, sprites) comes from [PokéAPI](https://pokeapi.co) at runtime and is cached in the browser; packs store only species slugs, which keeps them small.

## Disclaimer

Fan-made, non-commercial project. Pokémon and Pokémon character names are trademarks of Nintendo. This project hosts no ROMs and no patch files — get hacks from their official release pages and apply patches to a legally obtained base game. Base-game data is factual game information via PokéAPI and community documentation.
