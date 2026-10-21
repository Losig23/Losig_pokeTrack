import type { Area, Boss, BossMon, CaughtMon, SpeciesData } from "./types";
import { effectiveness } from "./typeChart";
import { bestMatchup } from "./coverage";
import { computeStat } from "./iv";

// Boss prep v1 (spec §5): matchup + speed counter scan. No damage calc (v2).
// Matchups use a STAB view — a Pokémon is assumed to attack with its own
// types and to be hit by the boss member's own types, refined by the boss
// member's actual moves where the pack records them (for trap detection).

export type Verdict = "check" | "wall" | "outspeed";

export interface PrepCandidate {
  mon: CaughtMon;
  data: SpeciesData;
  /** Best STAB multiplier this mon hits the boss member for. */
  offense: number;
  /** Best STAB multiplier the boss member hits this mon for. */
  defense: number;
  /** Estimated speed stat at each side's level (IV 15, neutral — see below). */
  estSpeed: number;
  bossEstSpeed: number;
  outspeeds: boolean;
  verdicts: Verdict[];
  /** Set when the pick looks good on type but folds — to boss STAB or to a coverage move. */
  trapReason?: string;
}

export interface BossMonPrep {
  bossMon: BossMon;
  data: SpeciesData | null;
  isAce: boolean;
  /** Every roster mon (party + box, alive) with a notable matchup, best first. */
  candidates: PrepCandidate[];
  checks: PrepCandidate[];
  walls: PrepCandidate[];
  traps: PrepCandidate[];
  /** True when nothing available resists this boss member (spec: threat list). */
  threat: boolean;
  /** Catchable species in the areas leading up to this boss that would check it. */
  catchSuggestions: { species: string; areaName: string }[];
}

export interface PrepReport {
  boss: Boss;
  perMon: BossMonPrep[];
  threats: BossMonPrep[];
  aceThreat: boolean;
  recommendedLead: { mon: CaughtMon; against: BossMon } | null;
  checklist: string[];
}

const fmtMult = (m: number) => (m === 0 ? "immune" : `×${m}`);

/** Estimated speed at a level: base speed through the stat formula, IV 15, no EVs. */
function estSpeed(data: SpeciesData, level: number, nature?: string): number {
  return computeStat(data.baseStats.speed, 15, 0, level, "speed", nature);
}

function label(mon: CaughtMon): string {
  return mon.nickname || mon.species;
}

export function buildPrepReport(args: {
  boss: Boss;
  /** Available Pokémon: party + box (not graveyard). */
  roster: CaughtMon[];
  species: Record<string, SpeciesData>;
  /** Move slug → type, for bosses whose packs record movesets. Optional. */
  moveTypes?: Record<string, string>;
  /** Areas in the segment leading up to this boss (for catch suggestions). */
  segmentAreas?: Area[];
  /** Species slug → types for pool species in those areas (whatever is loaded). */
  poolTypes?: Record<string, string[]>;
}): PrepReport {
  const { boss, roster, species } = args;
  const moveTypes = args.moveTypes ?? {};
  const aceLevel = Math.max(...boss.team.map((m) => m.level));

  const perMon: BossMonPrep[] = boss.team.map((bossMon) => {
    const data = species[bossMon.species] ?? null;
    const bossSpeed = data ? estSpeed(data, bossMon.level) : 0;
    const candidates: PrepCandidate[] = [];

    if (data) {
      for (const mon of roster) {
        const monData = species[mon.species];
        if (!monData) continue;
        const offense = bestMatchup(monData.types, data.types);
        const defense = bestMatchup(data.types, monData.types);
        const mySpeed = estSpeed(monData, mon.level, mon.nature);
        const outspeeds = mySpeed > bossSpeed;
        const verdicts: Verdict[] = [];
        if (offense >= 2 && defense <= 1) verdicts.push("check");
        if (defense <= 0.5) verdicts.push("wall");
        if (outspeeds) verdicts.push("outspeed");

        let trapReason: string | undefined;
        if (offense >= 2 && defense >= 2) {
          trapReason = `hits it super-effectively but takes ${fmtMult(defense)} back from its STAB`;
        } else if (verdicts.includes("check") || verdicts.includes("wall")) {
          // A pick that survives STAB can still fold to a coverage move.
          for (const move of bossMon.moves) {
            const moveType = moveTypes[move];
            if (!moveType) continue;
            const moveEff = effectiveness(moveType, monData.types);
            if (moveEff >= 2) {
              trapReason = `folds to its ${move} (${moveType}, ${fmtMult(moveEff)})`;
              break;
            }
          }
        }
        candidates.push({
          mon, data: monData, offense, defense,
          estSpeed: mySpeed, bossEstSpeed: bossSpeed, outspeeds, verdicts, trapReason,
        });
      }
    }

    const rank = (c: PrepCandidate) =>
      (c.trapReason ? 100 : 0) + c.defense * 10 - c.offense * 3 - (c.outspeeds ? 1 : 0);
    candidates.sort((a, b) => rank(a) - rank(b));

    const checks = candidates.filter((c) => c.verdicts.includes("check") && !c.trapReason);
    const walls = candidates.filter(
      (c) => c.verdicts.includes("wall") && !c.verdicts.includes("check") && !c.trapReason,
    );
    const traps = candidates.filter((c) => c.trapReason);
    const threat = candidates.every((c) => c.defense >= 1);

    const catchSuggestions: { species: string; areaName: string }[] = [];
    if (data && threat) {
      for (const area of args.segmentAreas ?? []) {
        for (const pool of area.encounters) {
          const types = args.poolTypes?.[pool.species];
          if (!types) continue;
          if (bestMatchup(types, data.types) >= 2 && bestMatchup(data.types, types) <= 1) {
            catchSuggestions.push({ species: pool.species, areaName: area.name });
            if (catchSuggestions.length >= 3) break;
          }
        }
        if (catchSuggestions.length >= 3) break;
      }
    }

    return {
      bossMon, data, isAce: bossMon.level === aceLevel,
      candidates, checks, walls, traps, threat, catchSuggestions,
    };
  });

  const threats = perMon.filter((p) => p.threat);
  const aceThreat = threats.some((p) => p.isAce);

  // Recommended lead: best party answer to the boss's own lead, preferring
  // checks, then walls, then the fastest safe pivot.
  let recommendedLead: PrepReport["recommendedLead"] = null;
  const leadPrep = perMon[0];
  if (leadPrep) {
    const partyCandidates = leadPrep.candidates.filter(
      (c) => c.mon.status === "party" && !c.trapReason,
    );
    const best =
      partyCandidates.find((c) => c.verdicts.includes("check")) ??
      partyCandidates.find((c) => c.verdicts.includes("wall")) ??
      partyCandidates[0];
    if (best) recommendedLead = { mon: best.mon, against: leadPrep.bossMon };
  }

  const checklist: string[] = [];
  const party = roster.filter((m) => m.status === "party");
  for (const mon of party) {
    if (mon.level > boss.levelCap) {
      checklist.push(`${label(mon)} is Lv ${mon.level} — ${mon.level - boss.levelCap} over the Lv ${boss.levelCap} cap.`);
    } else if (mon.level === boss.levelCap) {
      checklist.push(`${label(mon)} is exactly at the Lv ${boss.levelCap} cap.`);
    }
  }
  const nearCap = party.filter((m) => boss.levelCap - m.level > 0 && boss.levelCap - m.level <= 3);
  if (nearCap.length) {
    checklist.push(`Close to cap: ${nearCap.map((m) => `${label(m)} (Lv ${m.level})`).join(", ")} — a little grinding tops them off.`);
  }
  for (const t of threats) {
    checklist.push(
      `No answer for ${t.bossMon.species} (${t.data ? t.data.types.join("/") : "?"}${t.isAce ? ", the ace" : ""}) — nothing you have resists it.`,
    );
    for (const s of t.catchSuggestions) {
      checklist.push(`Catch option: ${s.species} on ${s.areaName} would check ${t.bossMon.species}.`);
    }
    if (!t.catchSuggestions.length) {
      checklist.push(`Nothing in the areas before ${boss.name} checks ${t.bossMon.species} — plan a pivot or a sack.`);
    }
  }
  for (const p of perMon) {
    for (const c of p.checks) {
      if (c.mon.status === "box") {
        checklist.push(`In the box: ${label(c.mon)} checks ${p.bossMon.species} — consider swapping it in.`);
      }
    }
    for (const t of p.traps) {
      checklist.push(`Trap pick: ${label(t.mon)} into ${p.bossMon.species} — ${t.trapReason}.`);
    }
  }
  if (recommendedLead) {
    checklist.push(`Suggested lead: ${label(recommendedLead.mon)} into ${recommendedLead.against.species}.`);
  }
  if (!checklist.length) checklist.push("No flags — your party matches up cleanly on typing and levels.");

  return { boss, perMon, threats, aceThreat, recommendedLead, checklist };
}
