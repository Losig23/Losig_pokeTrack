import type { Area, Boss, GamePack, Ruleset, Run } from "./types";
import { sortedAreas, sortedBosses } from "./pack";

export function createRun(packId: string, ruleset: Ruleset, name: string, attempts = 1): Run {
  return {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    packId,
    ruleset,
    name,
    createdAt: new Date().toISOString(),
    status: "in-progress",
    attempts,
    encounters: [],
    team: [],
    defeatedBossIds: [],
    customAreas: [],
  };
}

/** All loggable areas for a run: the pack's areas (game order), then the player's custom areas. */
export function allAreas(run: Run, pack: GamePack): Area[] {
  return [...sortedAreas(pack), ...(run.customAreas ?? [])];
}

export interface BossSegment {
  boss: Boss;
  areas: Area[];
}

/**
 * Group areas into the segment leading up to each boss, so the encounter
 * list reads as "everything you can catch before this fight".
 *
 * Pack area orders and boss orders use different scales (areas span the
 * whole map, bosses span the boss list), so segments are assigned by
 * relative progress: an area belongs to the first boss whose relative
 * position in the boss list is at or past the area's relative position in
 * the area list. Areas past the final boss come back as `trailing`.
 * This is an approximation of story order, not pack-exact data.
 */
export function bossSegments(
  pack: GamePack,
  areas: Area[],
): { segments: BossSegment[]; trailing: Area[] } {
  const bosses = sortedBosses(pack);
  if (bosses.length === 0) return { segments: [], trailing: areas };
  const maxBossOrder = Math.max(...bosses.map((b) => b.order));
  const maxAreaOrder = Math.max(...areas.map((a) => a.order), 1);
  const segments: BossSegment[] = bosses.map((boss) => ({ boss, areas: [] }));
  const trailing: Area[] = [];
  let bi = 0;
  for (const area of areas) {
    const frac = area.order / maxAreaOrder;
    while (bi < bosses.length - 1 && bosses[bi].order / maxBossOrder < frac) bi++;
    if (frac <= bosses[bi].order / maxBossOrder) segments[bi].areas.push(area);
    else trailing.push(area);
  }
  return { segments, trailing };
}

/** The next unbeaten boss in game order, or null when every boss is beaten. */
export function nextBoss(run: Run, pack: GamePack): Boss | null {
  return sortedBosses(pack).find((b) => !run.defeatedBossIds.includes(b.id)) ?? null;
}

/** Current level cap for the run: the next boss's ace (hardcore Nuzlocke rule). */
export function currentLevelCap(run: Run, pack: GamePack): number | null {
  return nextBoss(run, pack)?.levelCap ?? null;
}

/** Party members that are over the current level cap (hardcore warning). */
export function overCapMembers(run: Run, pack: GamePack) {
  const cap = currentLevelCap(run, pack);
  if (cap === null) return [];
  return run.team.filter((m) => m.status === "party" && m.level > cap);
}

/**
 * Dupes-clause check: species lines already caught in this run.
 * v1 compares exact species (evolution-line awareness needs line data per pack).
 */
export function caughtSpecies(run: Run): Set<string> {
  return new Set(run.team.map((m) => m.species));
}

export function isDupe(run: Run, species: string): boolean {
  return caughtSpecies(run).has(species);
}

/** Run progress: defeated bosses out of total, as a percentage. */
export function progressPercent(run: Run, pack: GamePack): number {
  if (!pack.bosses.length) return 0;
  const done = pack.bosses.filter((b) => run.defeatedBossIds.includes(b.id)).length;
  return Math.round((done / pack.bosses.length) * 100);
}
