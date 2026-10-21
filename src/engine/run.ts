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
/** League bosses (Elite Four members + the Champion) receive no encounters:
 *  by the time a run reaches the league, its catching is done — those areas
 *  belong to the last pre-league boss's segment instead. Detected by name
 *  because pack data doesn't carry a boss kind. Post-league bosses whose
 *  names aren't league titles (Red, N, Ghetsis) still receive areas. */
const LEAGUE_NAME = /^(elite four)\b|champion/i;

export function bossSegments(
  pack: GamePack,
  areas: Area[],
): { segments: BossSegment[]; trailing: Area[] } {
  const bosses = sortedBosses(pack);
  if (bosses.length === 0) return { segments: [], trailing: areas };
  const maxBossOrder = Math.max(...bosses.map((b) => b.order));
  const maxAreaOrder = Math.max(...areas.map((a) => a.order), 1);
  const segments: BossSegment[] = bosses.map((boss) => ({ boss, areas: [] }));
  const segmentOf = new Map(bosses.map((b, i) => [b.id, segments[i]]));
  const receivers = bosses.filter((b) => !LEAGUE_NAME.test(b.name));
  const pool = receivers.length > 0 ? receivers : bosses;
  for (const area of areas) {
    const frac = area.order / maxAreaOrder;
    const target =
      pool.find((b) => b.order / maxBossOrder >= frac) ?? pool[pool.length - 1];
    segmentOf.get(target.id)?.areas.push(area);
  }
  // Nothing trails anymore: every area lands in some boss's segment.
  return { segments, trailing: [] };
}

/**
 * Bosses grouped into progression slots by their order value. Variants
 * sharing a slot (the Striaton trio by starter, Drayden/Iris by version,
 * Bea/Allister…) are ONE checkpoint — one badge: beating any variant
 * clears the slot, and progression moves to the next slot.
 */
export function bossSlots(pack: GamePack): Boss[][] {
  const byOrder = new Map<number, Boss[]>();
  for (const boss of sortedBosses(pack)) {
    const slot = byOrder.get(boss.order) ?? [];
    slot.push(boss);
    byOrder.set(boss.order, slot);
  }
  return [...byOrder.values()];
}

export function slotDefeated(run: Run, slot: Boss[]): boolean {
  return slot.some((b) => run.defeatedBossIds.includes(b.id));
}

/** Checkpoints cleared (badges earned) out of total checkpoints. */
export function checkpoints(run: Run, pack: GamePack): { done: number; total: number } {
  const slots = bossSlots(pack);
  return { done: slots.filter((s) => slotDefeated(run, s)).length, total: slots.length };
}

/** The next uncleared checkpoint's boss, or null when the run is complete. */
export function nextBoss(run: Run, pack: GamePack): Boss | null {
  for (const slot of bossSlots(pack)) {
    if (!slotDefeated(run, slot)) {
      return slot.find((b) => !run.defeatedBossIds.includes(b.id)) ?? slot[0];
    }
  }
  return null;
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

/** Run progress: checkpoints cleared out of total checkpoints, as a percentage. */
export function progressPercent(run: Run, pack: GamePack): number {
  const { done, total } = checkpoints(run, pack);
  if (!total) return 0;
  return Math.round((done / total) * 100);
}
