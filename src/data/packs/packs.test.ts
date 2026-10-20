import { describe, expect, it } from "vitest";
import { PACKS } from "./index";
import { validatePack } from "../../engine/pack";

// Every shipped pack must satisfy the engine's structural rules.
// Packs with data still being gathered (empty areas/bosses) pass trivially;
// once data lands, cap/duplicate/range errors fail CI.
describe("shipped game packs", () => {
  for (const pack of PACKS) {
    it(`${pack.id} is structurally valid`, () => {
      expect(validatePack(pack)).toEqual([]);
    });
  }
});
