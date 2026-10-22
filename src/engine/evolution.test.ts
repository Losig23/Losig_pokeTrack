import { describe, expect, it } from "vitest";
import { nextEvolutions, type ChainNode, type EvoDetail } from "./evolution";

const detail = (patch: Partial<EvoDetail>): EvoDetail => ({
  min_level: null,
  trigger: { name: "level-up" },
  item: null,
  held_item: null,
  min_happiness: null,
  time_of_day: "",
  min_beauty: null,
  location: null,
  ...patch,
});

const node = (name: string, details: EvoDetail[], children: ChainNode[] = []): ChainNode => ({
  species: { name },
  evolution_details: details,
  evolves_to: children,
});

// Bulbasaur line (linear, level-based) + Eevee (branching, item-based).
const bulbasaurChain = node("bulbasaur", [], [
  node("ivysaur", [detail({ min_level: 16 })], [
    node("venusaur", [detail({ min_level: 32 })]),
  ]),
]);
const eeveeChain = node("eevee", [], [
  node("vaporeon", [detail({ trigger: { name: "use-item" }, item: { name: "water-stone" } })]),
  node("jolteon", [detail({ trigger: { name: "use-item" }, item: { name: "thunder-stone" } })]),
  node("espeon", [detail({ min_happiness: 220, time_of_day: "day" })]),
]);

describe("nextEvolutions", () => {
  it("returns the direct next form with its level", () => {
    expect(nextEvolutions(bulbasaurChain, "bulbasaur")).toEqual([
      { species: "ivysaur", detail: "Lv 16+" },
    ]);
    expect(nextEvolutions(bulbasaurChain, "ivysaur")).toEqual([
      { species: "venusaur", detail: "Lv 32+" },
    ]);
  });

  it("returns nothing for a final form or an unknown species", () => {
    expect(nextEvolutions(bulbasaurChain, "venusaur")).toEqual([]);
    expect(nextEvolutions(bulbasaurChain, "missingno")).toEqual([]);
  });

  it("lists every branch of a branching chain with its trigger", () => {
    const opts = nextEvolutions(eeveeChain, "eevee");
    expect(opts.map((o) => o.species)).toEqual(["vaporeon", "jolteon", "espeon"]);
    expect(opts[0].detail).toBe("Use Water Stone");
    expect(opts[2].detail).toContain("High friendship");
  });
});
