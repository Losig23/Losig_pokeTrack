import { describe, expect, it } from "vitest";
import { computeStat, ivRange, natureInfo, natureModifier } from "./iv";

// Bulbasaur base stats: HP 45, Atk 49.
describe("stat formula", () => {
  it("HP at level 5, perfect IV, no EVs is 21", () => {
    expect(computeStat(45, 31, 0, 5, "hp")).toBe(21);
  });

  it("HP at level 50 with 252 EVs and perfect IV", () => {
    // core = floor((90 + 31 + 63) · 50/100) = 92 → 92 + 50 + 10
    expect(computeStat(45, 31, 252, 50, "hp")).toBe(152);
  });

  it("applies the nature multiplier outside HP", () => {
    // Atk 49, IV 31, Lv 100: core 129 → (129 + 5) · 1.1 = 147.4 → 147
    expect(computeStat(49, 31, 0, 100, "attack", "Adamant")).toBe(147);
    expect(computeStat(49, 31, 0, 100, "attack", "Hardy")).toBe(134);
  });
});

describe("nature table", () => {
  it("Jolly boosts speed and hinders special attack; HP is never modified", () => {
    expect(natureModifier("Jolly", "speed")).toBe(1.1);
    expect(natureModifier("Jolly", "specialAttack")).toBe(0.9);
    expect(natureModifier("Jolly", "hp")).toBe(1);
    expect(natureInfo("adamant").up).toBe("attack"); // case-insensitive
  });
});

describe("ivRange solver", () => {
  it("low levels give an honest range, not a fake exact number", () => {
    // Bulbasaur HP 21 at Lv 5 fits IV 30 and 31 only
    expect(ivRange(45, 5, 0, 21, "hp")).toEqual({ min: 30, max: 31 });
    // Bulbasaur Atk 11 at Lv 5 (neutral) fits IV 22–31
    expect(ivRange(49, 5, 0, 11, "attack")).toEqual({ min: 22, max: 31 });
  });

  it("level 100 pins the IV exactly", () => {
    expect(ivRange(49, 100, 0, 134, "attack", "Hardy")).toEqual({ min: 31, max: 31 });
    expect(ivRange(49, 100, 0, 147, "attack", "Adamant")).toEqual({ min: 31, max: 31 });
  });

  it("returns null for an impossible stat instead of guessing", () => {
    expect(ivRange(45, 5, 0, 99, "hp")).toBeNull();
  });
});
