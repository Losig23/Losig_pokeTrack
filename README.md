# RunBook — ROM Hack Run Logger (Losig_pokeTrack)

A run logger for Pokémon **ROM hacks** — not mainline games — with boss preparation built on top of your logged run.

Mainline trackers can't cover these games: boss teams, encounter tables, level caps, and even Pokémon stats differ per hack, and the data lives in community documentation. RunBook's answer is a **game-pack architecture**: the app engine is game-agnostic, and each hack is a single versioned JSON data file (areas, encounter pools, boss teams, per-hack overrides). Adding a game is a data contribution, not new code.

## Features (Phase 1)

- **Run logging** for three rulesets: casual playthrough, Nuzlocke, and Hardcore Nuzlocke (level-cap warnings)
- **Encounter log** per area, in game order, with dupes-clause flagging
- **Party / Box / Graveyard** roster management with a by-typing team coverage report (including "uncovered threats")
- **Boss tracking**: next-boss card with the full team and level cap, defeat progress across the whole game
- **Local-first**: runs persist in your browser (localStorage); no account, no backend
- Desktop-first UI (phone pass planned)

## Roadmap

- **Phase 2 — Boss prep**: counter scan of your party + box against a boss team (matchups, speed tiers, trap picks, threat list, prep checklist)
- **Phase 3 — More packs**: Inclement Emerald, Emerald Kaizo, Run & Bun, Drayano hacks, story hacks (Gaia, Prism, …), and fan games (Reborn, Insurgence) — 20 games targeted
- **Phase 4 — Polish**: run summary share cards, JSON run export/import, damage calculator evaluation

## Game packs

Launch packs: **Radical Red**, **Unbound**, **Renegade Platinum**. Pack data is community-sourced from each hack's official documentation (sources are recorded inside each pack file) and is labelled with a data-quality level. Encounter and boss coverage grows pack by pack; the full list of planned packs is in `src/data/packs/index.ts`.

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

Fan-made, non-commercial project. Pokémon and Pokémon character names are trademarks of Nintendo. This project hosts no ROMs and no patch files — get hacks from their official release pages and apply patches to a legally obtained base game.
