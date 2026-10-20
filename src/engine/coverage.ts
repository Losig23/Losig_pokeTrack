import type { SpeciesData } from "./types";
import { TYPES, effectiveness } from "./typeChart";

export interface CoverageReport {
  /** Attacking types (from the team's own typings, STAB view) that hit each type super-effectively. */
  offensive: Record<string, boolean>;
  /** For each defending type, how many team members are weak to it (defensive exposure). */
  defensiveWeaknessCounts: Record<string, number>;
  /** Types no team member resists and at least one member is weak to — the danger list. */
  uncoveredThreats: string[];
}

/**
 * Team coverage from the team's typings.
 * Offensive: a type is "covered" if any team member's own type is super-effective into it
 * (a STAB approximation — full move-level coverage arrives with moveset data in Phase 2).
 * Defensive: count, per attacking type, how many members take super-effective damage.
 */
export function teamCoverage(members: SpeciesData[]): CoverageReport {
  const offensive: Record<string, boolean> = {};
  const defensiveWeaknessCounts: Record<string, number> = {};
  const resists: Record<string, boolean> = {};

  for (const type of TYPES) {
    offensive[type] = members.some((m) =>
      m.types.some((own) => effectiveness(own, [type]) > 1),
    );
    defensiveWeaknessCounts[type] = members.filter(
      (m) => effectiveness(type, m.types) > 1,
    ).length;
    resists[type] = members.some((m) => effectiveness(type, m.types) < 1);
  }

  const uncoveredThreats = TYPES.filter(
    (t) => defensiveWeaknessCounts[t] > 0 && !resists[t],
  );

  return { offensive, defensiveWeaknessCounts, uncoveredThreats };
}

/** Matchup multiplier of an attacker (by its types, STAB view) into a defender's types. */
export function bestMatchup(attackerTypes: string[], defenderTypes: string[]): number {
  return Math.max(...attackerTypes.map((t) => effectiveness(t, defenderTypes)), 0);
}
