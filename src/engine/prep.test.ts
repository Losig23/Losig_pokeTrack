import { describe, expect, it } from "vitest";
import type { Boss, CaughtMon, SpeciesData } from "./types";
import { buildPrepReport } from "./prep";

const sd = (slug: string, types: string[], speed: number): SpeciesData => ({
  id: 1, slug, name: slug, types,
  baseStats: { hp: 80, attack: 80, defense: 80, specialAttack: 80, specialDefense: 80, speed },
  sprite: "",
});
const mon = (species: string, level: number, status: "party" | "box"): CaughtMon => ({
  uid: `u-${species}`, species, level, status, caughtAreaId: "a1",
});

const species: Record<string, SpeciesData> = {
  gyarados: sd("gyarados", ["water", "flying"], 81),
  heatran: sd("heatran", ["fire", "steel"], 77),
  jolteon: sd("jolteon", ["electric"], 130),
  golem: sd("golem", ["rock", "ground"], 45),
  magnemite: sd("magnemite", ["electric", "steel"], 45),
};

const boss: Boss = {
  id: "b1", name: "Test Leader", location: "Gym", order: 10, levelCap: 50,
  team: [
    { species: "gyarados", level: 50, moves: ["ice-fang"] },
    { species: "heatran", level: 50, moves: [] },
  ],
};

const roster: CaughtMon[] = [
  mon("jolteon", 48, "party"),
  mon("golem", 55, "party"),
  mon("magnemite", 30, "box"),
];

describe("boss prep counter scan", () => {
  const report = buildPrepReport({
    boss, roster, species,
    moveTypes: { "ice-fang": "ice" },
    segmentAreas: [{
      id: "route-x", name: "Route X", order: 10,
      encounters: [{ species: "diglett", minLevel: 15, maxLevel: 20, methods: ["grass"] }],
    }],
    poolTypes: { diglett: ["ground"] },
  });
  const [gyarados, heatran] = report.perMon;

  it("finds the check: Jolteon hits Gyarados ×4, takes neutral, outspeeds", () => {
    const jolt = gyarados.checks.find((c) => c.mon.species === "jolteon");
    expect(jolt).toBeTruthy();
    expect(jolt?.offense).toBe(4);
    expect(jolt?.defense).toBe(1);
    expect(jolt?.outspeeds).toBe(true);
  });

  it("flags the trap: Golem hits Gyarados super-effectively but takes ×4 back", () => {
    const golem = gyarados.traps.find((c) => c.mon.species === "golem");
    expect(golem).toBeTruthy();
    expect(golem?.trapReason).toContain("STAB");
    // Same verdict without any moveset data — the STAB trap needs no moves.
    const noMoves = buildPrepReport({
      boss: { ...boss, team: [{ species: "gyarados", level: 50, moves: [] }] },
      roster, species,
    });
    expect(noMoves.perMon[0].traps.some((c) => c.mon.species === "golem")).toBe(true);
  });

  it("a clean check is not trapped by an irrelevant coverage move", () => {
    // Magnemite (electric/steel) is a Gyarados check; Ice Fang into it is ×0.5.
    const mag = gyarados.checks.find((c) => c.mon.species === "magnemite");
    expect(mag).toBeTruthy();
    expect(mag?.trapReason).toBeUndefined();
  });

  it("heatran is a threat: nobody resists it, and the checklist says so + offers Diglett", () => {
    expect(heatran.threat).toBe(true);
    expect(report.threats.map((t) => t.bossMon.species)).toContain("heatran");
    expect(report.checklist.some((l) => l.includes("No answer for heatran"))).toBe(true);
    expect(report.checklist.some((l) => l.includes("diglett") && l.includes("Route X"))).toBe(true);
  });

  it("box counters surface in the checklist", () => {
    expect(report.checklist.some((l) => l.includes("In the box") && l.includes("magnemite"))).toBe(true);
  });

  it("level-cap status: Golem at 55 is flagged over the 50 cap", () => {
    expect(report.checklist.some((l) => l.includes("golem") && l.includes("over the Lv 50 cap"))).toBe(true);
  });

  it("recommended lead is the party check against the boss's lead", () => {
    expect(report.recommendedLead?.mon.species).toBe("jolteon");
    expect(report.recommendedLead?.against.species).toBe("gyarados");
  });

  it("coverage moves trap picks that STAB alone would clear", () => {
    // Torterra 4×-checks Rhydon on type and walls its STAB — but Rhydon's
    // Ice Punch is ×4 into grass/ground. Textbook trap pick.
    const trapReport = buildPrepReport({
      boss: {
        id: "b2", name: "Trap Leader", location: "Gym", order: 10, levelCap: 40,
        team: [{ species: "rhydon", level: 40, moves: ["ice-punch"] }],
      },
      roster: [mon("torterra", 40, "party")],
      species: {
        rhydon: sd("rhydon", ["ground", "rock"], 40),
        torterra: sd("torterra", ["grass", "ground"], 56),
      },
      moveTypes: { "ice-punch": "ice" },
    });
    const tort = trapReport.perMon[0].traps.find((c) => c.mon.species === "torterra");
    expect(tort?.trapReason).toContain("ice-punch");
    expect(trapReport.perMon[0].checks).toHaveLength(0);
  });
});
