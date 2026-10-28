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

  it("every base pack with areas opens with its story start and segments by the story", () => {
    const segOf = (packId: string, bossId: string) => {
      const pack = getPack(packId)!;
      const { segments } = bossSegments(pack, sortedAreas(pack));
      return segments.find((s) => s.boss.id === bossId)?.areas.map((a) => a.id) ?? [];
    };
    const first = (packId: string) => sortedAreas(getPack(packId)!)[0].id;
    // Hoenn: Petalburg Woods are before Roxanne, not Brawly.
    expect(first("emerald")).toBe("littleroot-town");
    expect(segOf("emerald", "roxanne")).toContain("petalburg-woods");
    expect(segOf("emerald", "roxanne")).toContain("rustboro-city");
    expect(segOf("emerald", "flannery")).toContain("lavaridge-town");
    // Fallarbor / Route 114 / Meteor Falls are on the way to Lavaridge,
    // not after it: they belong to Flannery, not Norman. There are no
    // new areas between Flannery and Norman (you walk back to Petalburg
    // through areas already visited), so Norman's segment is empty.
    expect(segOf("emerald", "flannery")).toContain("hoenn-route-114");
    expect(segOf("emerald", "flannery")).toContain("meteor-falls");
    expect(segOf("emerald", "flannery")).toContain("jagged-pass");
    expect(segOf("emerald", "norman")).not.toContain("hoenn-route-114");
    expect(segOf("emerald", "norman")).toEqual([]);
    expect(segOf("omega-ruby-alpha-sapphire", "oras-flannery")).toContain("fallarbor-town");
    expect(segOf("omega-ruby-alpha-sapphire", "oras-flannery")).toContain("hoenn-route-114");
    expect(first("ruby-sapphire")).toBe("hoenn-route-101");
    expect(segOf("ruby-sapphire", "roxanne")).toContain("petalburg-woods");
    expect(first("omega-ruby-alpha-sapphire")).toBe("hoenn-route-101");
    expect(segOf("omega-ruby-alpha-sapphire", "oras-roxanne")).toContain("petalburg-woods");
    // Kanto: Route 1 first, Viridian Forest before Brock, Mt. Moon before Misty.
    for (const id of ["red-blue", "yellow", "firered-leafgreen", "lets-go"]) {
      expect(first(id)).toBe("pallet-town");
    }
    expect(segOf("red-blue", "brock")).toContain("viridian-forest");
    expect(segOf("red-blue", "misty")).toContain("mt-moon");
    expect(segOf("red-blue", "misty")).toContain("kanto-route-25");
    // Johto: New Bark first, Blackthorn with Clair, Kanto after Johto.
    for (const id of ["gold-silver", "crystal", "heartgold-soulsilver"]) {
      expect(first(id)).toBe("new-bark-town");
      expect(segOf(id, "clair")).toContain("blackthorn-city");
    }
    expect(segOf("heartgold-soulsilver", "brock")).toContain("pewter-city");
    // Sinnoh: Twinleaf first, Eterna Forest with Gardenia, Sunyshore with Volkner.
    for (const id of ["diamond-pearl", "platinum"]) {
      expect(first(id)).toBe("twinleaf-town");
      expect(segOf(id, "gardenia")).toContain("eterna-forest");
      expect(segOf(id, "volkner")).toContain("sunyshore-city");
    }
    expect(segOf("platinum", "fantina")).toContain("hearthome-city");
    // Unova sequel: Aspertia first, Castelia with Burgh, not at the tail.
    expect(first("black-2-white-2")).toBe("aspertia-city");
    expect(segOf("black-2-white-2", "burgh")).toContain("castelia-city");
    expect(segOf("black-white", "lenora")).toContain("nacrene-city");
    // Alola: Route 1 first, Verdant Cavern with the first trial.
    for (const id of ["sun-moon", "ultra-sun-ultra-moon"]) {
      expect(first(id)).toBe("alola-route-1");
      expect(segOf(id, "totem-gumshoos")).toContain("verdant-cavern");
    }
    // Galar: Postwick first, Turffield with Milo, not last.
    expect(first("sword-shield")).toBe("postwick");
    expect(segOf("sword-shield", "milo")).toContain("turffield");
    expect(segOf("sword-shield", "nessa")).toContain("hulbury");
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
