import { describe, expect, it } from "vitest";
import { PACKS, getPack } from "./index";
import { sortedAreas, validatePack, visibleStoryBosses } from "../../engine/pack";
import { REGION_MAPS } from "../maps";
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
    // not after it: they belong to Flannery, not Norman. In Emerald,
    // Norman's only new area is Mirage Tower (Go-Goggles + Mach Bike);
    // in Ruby/Sapphire Norman's segment is empty by design.
    expect(segOf("emerald", "flannery")).toContain("hoenn-route-114");
    expect(segOf("emerald", "flannery")).toContain("meteor-falls");
    expect(segOf("emerald", "flannery")).toContain("jagged-pass");
    expect(segOf("emerald", "norman")).not.toContain("hoenn-route-114");
    expect(segOf("emerald", "norman")).toEqual(["mirage-tower"]);
    expect(segOf("ruby-sapphire", "norman")).toEqual([]);
    // Walkthrough audit: Emerald Juan is only 127/128/Sootopolis/Cave/
    // surf to Sky Pillar, not 29 routes; the rest is League & postgame.
    expect(segOf("emerald", "juan")).toContain("sky-pillar");
    expect(segOf("emerald", "juan")).not.toContain("hoenn-battle-frontier");
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
    // Walkthrough audit, worst first:
    expect(segOf("black-2-white-2", "drayden")).toContain("undella-town");
    expect(segOf("black-2-white-2", "marlon")).toContain("humilau-city");
    expect(segOf("gold-silver", "lt-surge")).toContain("vermilion-city");
    expect(segOf("gold-silver", "blue")).toContain("pallet-town");
    expect(segOf("sword-shield", "piers")).toContain("lake-of-outrage");
    expect(segOf("sword-shield", "raihan")).toEqual([]);
    expect(segOf("sun-moon", "kahuna-hapu")).toContain("poni-breaker-coast");
    expect(segOf("sun-moon", "totem-kommo-o")).toEqual(["vast-poni-canyon"]);
  });

  it("emerald story bosses: rival + Aqua/Magma, display-only", () => {
    const pack = getPack("emerald")!;
    const story = pack.storyBosses ?? [];
    // 5 rival fights x 3 starter variants + Tabitha x3, Maxie x3,
    // Shelly x2, Matt x1, Archie x1, Wally x2. Courtney is not battled in Emerald.
    expect(story.length).toBe(27);
    // Wally: Mauville Ralts, then the first Victory Road fight only
    // (post-League rematches scale up and are not story fights).
    const wally = story.filter((b) => b.id.startsWith("wally"));
    expect(wally.map((b) => b.order)).toEqual([28, 85]);
    expect(wally[0].team).toEqual([expect.objectContaining({ species: "ralts", level: 16 })]);
    expect(wally[1].levelCap).toBe(45);
    // A run with a starter sees only its rival variants (5) plus the
    // 12 non-rival story bosses; with no starter, every variant shows.
    expect(visibleStoryBosses(pack, "treecko").length).toBe(17);
    expect(visibleStoryBosses(pack, "treecko").filter((b) => b.id.startsWith("rival")).length).toBe(5);
    expect(visibleStoryBosses(pack).length).toBe(27);
    expect(story.some((b) => b.name.includes("Courtney"))).toBe(false);
    // Rival variants share one order per fight; the Space Center pair
    // shares its order too (one double battle with Steven).
    const rival110 = story.filter((b) => b.id.startsWith("rival-route-110"));
    expect(rival110.map((b) => b.order)).toEqual([25, 25, 25]);
    expect(rival110.find((b) => b.id.endsWith("treecko"))!.team).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ species: "combusken", level: 20 }),
      ]),
    );
    // Story bosses must not leak into checkpoints or level caps:
    // bossSegments and the gym list are driven by bosses only.
    const { segments } = bossSegments(pack, sortedAreas(pack));
    expect(segments.map((s) => s.boss.id)).not.toContain("archie-seafloor");
    expect(pack.bosses.some((b) => b.id === "archie-seafloor")).toBe(false);
    // Spot pins: Mt. Chimney leaders, Seafloor leaders, Lilycove rival ace.
    const byId = Object.fromEntries(story.map((b) => [b.id, b]));
    expect(byId["maxie-mt-chimney"].levelCap).toBe(25);
    expect(byId["archie-seafloor"].team).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ species: "sharpedo", level: 43 }),
      ]),
    );
    expect(byId["rival-lilycove-mudkip"].team).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ species: "grovyle", level: 34 }),
      ]),
    );
    // Story order interleaves with gym order (Route 103 before Roxanne,
    // Seafloor bosses between Tate & Liza and Juan).
    expect(byId["rival-route-103-treecko"].order).toBeLessThan(10);
    expect(byId["archie-seafloor"].order).toBeGreaterThan(70);
    expect(byId["archie-seafloor"].order).toBeLessThan(80);
  });

  it("emerald schematic map covers every path area and story boss", () => {
    const pack = getPack("emerald")!;
    const map = REGION_MAPS["emerald"];
    expect(map).toBeDefined();
    const { segments } = bossSegments(pack, sortedAreas(pack));
    const pathAreas = segments.flatMap((s) => s.areas);
    // Every area on the journey path (postgame trailing excluded) has a point.
    for (const a of pathAreas) expect(map.areas[a.id]).toBeDefined();
    // Every story boss has a point; gym cities without an area have one too.
    for (const sb of pack.storyBosses ?? []) expect(map.story[sb.id]).toBeDefined();
    expect(map.bosses["wattson"]).toBeDefined();
    expect(map.bosses["winona"]).toBeDefined();
    // All points sit inside the 1000x700 viewBox.
    for (const pt of [...Object.values(map.areas), ...Object.values(map.bosses), ...Object.values(map.story)]) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(1000);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThanOrEqual(700);
    }
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
      "aquacorde-town", "kalos-route-2", "santalune-forest", "kalos-route-3", "kalos-route-22",
    ]);
    // Lumiose City's encounters happen on the first visit (pre-Grant),
    // even though its gym is badge 5.
    expect(segOf("xy-grant")).toContain("lumiose-city");
    expect(segOf("xy-grant")).toContain("glittering-cave");
    expect(segOf("xy-korrina")).toContain("reflection-cave");
    expect(segOf("xy-korrina")).not.toContain("kalos-route-12");
  });
});
