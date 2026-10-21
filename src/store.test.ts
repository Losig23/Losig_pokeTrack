import { describe, expect, it } from "vitest";
import { exportRunsJson, parseRunsJson } from "./store";
import { createRun } from "./engine/run";

describe("run backup export/import", () => {
  it("round-trips runs through JSON", () => {
    const run = createRun("red-blue", "nuzlocke", "Backup test");
    run.team = [{
      uid: "m1", species: "bulbasaur", level: 5, status: "party", caughtAreaId: "custom-starter",
    }];
    const parsed = parseRunsJson(exportRunsJson([run]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("Backup test");
    expect(parsed[0].team[0].species).toBe("bulbasaur");
  });

  it("rejects malformed backups instead of throwing", () => {
    expect(parseRunsJson("not json")).toEqual([]);
    expect(parseRunsJson("{}")).toEqual([]);
    expect(parseRunsJson('{"runs":[{"id":1}]}')).toEqual([]);
  });
});
