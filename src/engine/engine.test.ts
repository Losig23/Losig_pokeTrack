import { describe, expect, it } from "vitest";
import type { GamePack, SpeciesData } from "./types";
import { validatePack } from "./pack";
import { createRun, currentLevelCap, isDupe, nextBoss, overCapMembers } from "./run";
import { teamCoverage } from "./coverage";
import { effectiveness } from "./typeChart";

const fixturePack: GamePack = {
  id: "fixture",
  name: "Fixture Hack",
  version: "1.0",
  baseGame: "FireRed",
  generation: 3,
  sourceDocs: [],
  dataQuality: "verified",
  areas: [
    {
      id: "route-1", name: "Route 1", order: 10,
      encounters: [{ species: "pidgey", minLevel: 2, maxLevel: 5, methods: ["grass"] }],
    },
  ],
  bosses: [
    {
      id: "brock", name: "Gym Leader Brock", location: "Pewter Gym", order: 20, levelCap: 14,
      team: [
        { species: "geodude", level: 12, moves: [] },
        { species: "onix", level: 14, moves: [] },
      ],
    },
    {
      id: "misty", name: "Gym Leader Misty", location: "Cerulean Gym", order: 30, levelCap: 21,
      team: [{ species: "starmie", level: 21, moves: [] }],
    },
  ],
};

const species = (slug: string, types: string[]): SpeciesData => ({
  id: 1, slug, name: slug, types,
  baseStats: { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 },
  sprite: "",
});

describe("validatePack", () => {
  it("accepts the fixture pack", () => {
    expect(validatePack(fixturePack)).toEqual([]);
  });

  it("flags a level cap that does not match the ace", () => {
    const bad = structuredClone(fixturePack);
    bad.bosses[0].levelCap = 99;
    expect(validatePack(bad).some((p) => p.includes("levelCap"))).toBe(true);
  });

  it("flags duplicate area ids and inverted level ranges", () => {
    const bad = structuredClone(fixturePack);
    bad.areas.push(structuredClone(bad.areas[0]));
    bad.areas[0].encounters[0].minLevel = 50;
    const problems = validatePack(bad);
    expect(problems.some((p) => p.includes("duplicate area"))).toBe(true);
    expect(problems.some((p) => p.includes("minLevel"))).toBe(true);
  });
});

describe("run engine", () => {
  it("next boss follows game order and skips defeated bosses", () => {
    const run = createRun("fixture", "hardcore", "Test");
    expect(nextBoss(run, fixturePack)?.id).toBe("brock");
    run.defeatedBossIds = ["brock"];
    expect(nextBoss(run, fixturePack)?.id).toBe("misty");
    run.defeatedBossIds = ["brock", "misty"];
    expect(nextBoss(run, fixturePack)).toBeNull();
  });

  it("level cap tracks the next boss ace", () => {
    const run = createRun("fixture", "hardcore", "Test");
    expect(currentLevelCap(run, fixturePack)).toBe(14);
    run.defeatedBossIds = ["brock"];
    expect(currentLevelCap(run, fixturePack)).toBe(21);
  });

  it("flags party members over the hardcore cap", () => {
    const run = createRun("fixture", "hardcore", "Test");
    run.team = [{
      uid: "m1", species: "charizard", level: 20, status: "party", caughtAreaId: "route-1",
    }];
    expect(overCapMembers(run, fixturePack).map((m) => m.uid)).toEqual(["m1"]);
  });

  it("dupes clause: a species already caught counts as a dupe", () => {
    const run = createRun("fixture", "nuzlocke", "Test");
    run.team = [{
      uid: "m1", species: "pidgey", level: 3, status: "party", caughtAreaId: "route-1",
    }];
    expect(isDupe(run, "pidgey")).toBe(true);
    expect(isDupe(run, "rattata")).toBe(false);
  });
});

describe("type chart + coverage", () => {
  it("effectiveness multiplies across dual types and immunities", () => {
    expect(effectiveness("electric", ["water", "flying"])).toBe(4);
    expect(effectiveness("electric", ["ground"])).toBe(0);
    expect(effectiveness("fighting", ["normal"])).toBe(2);
  });

  it("coverage reports offensive reach and uncovered threats", () => {
    // Charizard alone: Fire/Flying. Weak to Rock (4x), Water, Electric; resists none of Rock/Water/Electric.
    const report = teamCoverage([species("charizard", ["fire", "flying"])]);
    expect(report.offensive["grass"]).toBe(true);
    expect(report.uncoveredThreats).toContain("rock");
    expect(report.defensiveWeaknessCounts["rock"]).toBe(1);
  });
});
