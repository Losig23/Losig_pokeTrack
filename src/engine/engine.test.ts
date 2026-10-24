import { describe, expect, it } from "vitest";
import type { GamePack, SpeciesData } from "./types";
import { validatePack } from "./pack";
import { allAreas, bossSegments, bossSlots, checkpoints, createRun, currentLevelCap, isDupe, nextBoss, overCapMembers, progressPercent } from "./run";
import { teamCoverage } from "./coverage";
import { effectiveness } from "./typeChart";

const fixturePack: GamePack = {
  id: "fixture",
  name: "Fixture Hack",
  version: "1.0",
  baseGame: "FireRed",
  generation: 3,
  category: "hack",
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

  it("authored segment cutoffs replace estimation", () => {
    const pack = structuredClone(fixturePack);
    pack.areas = [10, 20, 30, 40].map((order, i) => ({
      id: `a${i + 1}`, name: `Area ${i + 1}`, order,
      encounters: [{ species: "pidgey", minLevel: 2, maxLevel: 5, methods: ["grass"] }],
    }));
    pack.bossAreaCutoffs = { brock: "a2" };
    const { segments } = bossSegments(pack, pack.areas);
    const segOf = (bossId: string) => segments.find((s) => s.boss.id === bossId);
    expect(segOf("brock")?.areas.map((a) => a.id)).toEqual(["a1", "a2"]);
    // Misty has no cutoff: she takes everything after Brock's boundary.
    expect(segOf("misty")?.areas.map((a) => a.id)).toEqual(["a3", "a4"]);
  });

  it("a gym's city is never segmented before its own gym", () => {
    const pack = structuredClone(fixturePack);
    pack.areas.push({
      id: "cerulean-city", name: "Cerulean City", order: 1,
      encounters: [{ species: "zorua", minLevel: 10, maxLevel: 10, methods: ["event"] }],
    });
    const { segments } = bossSegments(pack, pack.areas);
    const segOf = (bossId: string) => segments.find((s) => s.boss.id === bossId);
    expect(segOf("misty")?.areas.map((a) => a.id)).toContain("cerulean-city");
    expect(segOf("brock")?.areas.map((a) => a.id)).not.toContain("cerulean-city");
  });

  it("variant bosses sharing an order slot are one checkpoint", () => {
    const pack = structuredClone(fixturePack);
    pack.bosses.push({
      id: "brock-variant", name: "Gym Leader Brock (variant)", location: "Pewter Gym",
      order: 20, levelCap: 14, team: [{ species: "onix", level: 14, moves: [] }],
    });
    expect(bossSlots(pack)).toHaveLength(2);
    const run = createRun("fixture", "hardcore", "Test");
    // Beating only the variant clears the slot: next up is Misty.
    run.defeatedBossIds = ["brock-variant"];
    expect(nextBoss(run, pack)?.id).toBe("misty");
    expect(checkpoints(run, pack)).toEqual({ done: 1, total: 2 });
    expect(progressPercent(run, pack)).toBe(50);
    run.defeatedBossIds = ["brock", "brock-variant", "misty"];
    expect(nextBoss(run, pack)).toBeNull();
    expect(progressPercent(run, pack)).toBe(100);
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

  it("boss segments group areas before each boss by relative progress", () => {
    const pack: GamePack = {
      ...fixturePack,
      areas: [10, 20, 30, 40].map((order) => ({
        id: `a${order}`, name: `Area ${order}`, order,
        encounters: [{ species: "pidgey", minLevel: 2, maxLevel: 5, methods: ["grass"] }],
      })),
      bosses: [
        { id: "b1", name: "Boss 1", location: "L1", order: 10, levelCap: 10, team: [{ species: "onix", level: 10, moves: [] }] },
        { id: "b2", name: "Boss 2", location: "L2", order: 20, levelCap: 20, team: [{ species: "onix", level: 20, moves: [] }] },
      ],
    };
    const { segments, trailing } = bossSegments(pack, pack.areas);
    // area fracs .25/.5/.75/1 vs boss fracs .5/1 → first two areas lead to b1, rest to b2
    expect(segments[0].areas.map((a) => a.id)).toEqual(["a10", "a20"]);
    expect(segments[1].areas.map((a) => a.id)).toEqual(["a30", "a40"]);
    expect(trailing).toEqual([]);
  });

  it("elite four and champion segments receive no encounters", () => {
    const pack: GamePack = {
      ...fixturePack,
      areas: [10, 20, 30, 40].map((order) => ({
        id: `a${order}`, name: `Area ${order}`, order,
        encounters: [{ species: "pidgey", minLevel: 2, maxLevel: 5, methods: ["grass"] }],
      })),
      bosses: [
        { id: "g1", name: "Gym Leader One", location: "L1", order: 10, levelCap: 10, team: [{ species: "onix", level: 10, moves: [] }] },
        { id: "e1", name: "Elite Four One", location: "League", order: 20, levelCap: 50, team: [{ species: "alakazam", level: 50, moves: [] }] },
        { id: "c1", name: "Champion One", location: "League", order: 30, levelCap: 60, team: [{ species: "charizard", level: 60, moves: [] }] },
      ],
    };
    const { segments } = bossSegments(pack, pack.areas);
    // area fracs .25–1.0; the gym (frac .33) is the only receiver, so it takes all areas
    expect(segments[0].areas).toHaveLength(4);
    expect(segments[1].areas).toHaveLength(0);
    expect(segments[2].areas).toHaveLength(0);
  });

  it("custom areas are appended after pack areas for logging", () => {
    const run = createRun("fixture", "nuzlocke", "Test");
    run.customAreas = [{
      id: "custom-safari", name: "Safari Zone", order: 100000,
      encounters: [{ species: "tauros", minLevel: 25, maxLevel: 25, methods: ["custom"] }],
    }];
    const areas = allAreas(run, fixturePack);
    expect(areas.map((a) => a.id)).toEqual(["route-1", "custom-safari"]);
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
