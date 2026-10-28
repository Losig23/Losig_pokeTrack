import { describe, expect, it } from "vitest";
import { PACKS } from "./packs";
import { HOME_THEME, PACK_THEMES, themeForPack } from "./themes";

describe("per-game themes", () => {
  it("home is Lucario, blue on black", () => {
    expect(HOME_THEME.mascot).toBe("lucario");
    expect(HOME_THEME.accent).toBe("#6ea8fe");
  });

  it("every base pack with areas has a theme", () => {
    for (const pack of PACKS.filter((p) => p.category === "base" && p.areas.length > 0)) {
      expect(PACK_THEMES[pack.id], pack.id).toBeDefined();
      expect(themeForPack(pack.id).mascot).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("unknown packs fall back to the home theme", () => {
    expect(themeForPack("not-a-pack")).toBe(HOME_THEME);
    expect(themeForPack(undefined)).toBe(HOME_THEME);
  });
});
