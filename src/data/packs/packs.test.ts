import { describe, expect, it } from "vitest";
import { PACKS, getPack } from "./index";
import { sortedAreas, validatePack } from "../../engine/pack";
import { bossSegments } from "../../engine/run";

// Every shipped pack must satisfy the engine's structural rules.
// Packs with data still being gathered (empty areas/bosses) pass trivially;
// once data lands, cap/duplicate/range errors fail CI.
describe("shipped game packs", () => {
  for (const pack of PACKS) {
    it(`${pack.id} is structurally valid`, () => {
      expect(validatePack(pack)).toEqual([]);
    });
  }

  it("every pack carries a known category", () => {
    for (const pack of PACKS) {
      expect(["base", "hack", "fangame"]).toContain(pack.category);
    }
  });

  it("base games cover all nine generations", () => {
    const base = PACKS.filter((p) => p.category === "base");
    expect(base.length).toBeGreaterThanOrEqual(20);
    for (let gen = 1; gen <= 9; gen++) {
      expect(base.some((p) => p.generation === gen)).toBe(true);
    }
  });

  it("red-blue Route 1 matches the games (Pidgey 2–5, Rattata 2–4)", () => {
    const pack = getPack("red-blue");
    const route1 = pack?.areas.find((a) => a.name === "Kanto Route 1");
    const pool = Object.fromEntries(
      (route1?.encounters ?? []).map((e) => [e.species, [e.minLevel, e.maxLevel]]),
    );
    expect(pool["pidgey"]).toEqual([2, 5]);
    expect(pool["rattata"]).toEqual([2, 4]);
  });

  it("x-y opens with the Aquacorde starter and segments by the story", () => {
    const pack = getPack("x-y");
    expect(pack).toBeDefined();
    const areas = sortedAreas(pack!);
    expect(areas[0].id).toBe("aquacorde-town");
    const { segments } = bossSegments(pack!, areas);
    const segOf = (bossId: string) =>
      segments.find((s) => s.boss.id === bossId)?.areas.map((a) => a.id) ?? [];
    expect(segOf("xy-viola")).toEqual([
      "aquacorde-town", "kalos-route-2", "santalune-forest", "kalos-route-3",
    ]);
    // Lumiose City's encounters happen on the first visit (pre-Grant),
    // even though its gym is badge 5.
    expect(segOf("xy-grant")).toContain("lumiose-city");
    expect(segOf("xy-grant")).toContain("glittering-cave");
    expect(segOf("xy-korrina")).toContain("reflection-cave");
    expect(segOf("xy-korrina")).not.toContain("kalos-route-12");
  });
});
