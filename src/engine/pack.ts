import type { GamePack } from "./types";

/** Structural validation for a game pack. Returns a list of problems (empty = valid). */
export function validatePack(pack: GamePack): string[] {
  const problems: string[] = [];
  if (!pack.id) problems.push("pack is missing an id");
  if (!pack.name) problems.push("pack is missing a name");
  if (!Array.isArray(pack.areas)) problems.push("pack.areas must be an array");
  if (!Array.isArray(pack.bosses)) problems.push("pack.bosses must be an array");

  const areaIds = new Set<string>();
  for (const area of pack.areas ?? []) {
    if (areaIds.has(area.id)) problems.push(`duplicate area id: ${area.id}`);
    areaIds.add(area.id);
    for (const enc of area.encounters ?? []) {
      if (!enc.species) problems.push(`area ${area.id} has an encounter with no species`);
      if (enc.minLevel > enc.maxLevel)
        problems.push(`area ${area.id}/${enc.species}: minLevel > maxLevel`);
    }
  }

  const bossIds = new Set<string>();
  for (const boss of pack.bosses ?? []) {
    if (bossIds.has(boss.id)) problems.push(`duplicate boss id: ${boss.id}`);
    bossIds.add(boss.id);
    if (!boss.team?.length) problems.push(`boss ${boss.id} has an empty team`);
    const ace = Math.max(...(boss.team ?? []).map((m) => m.level), 0);
    if (boss.levelCap !== ace)
      problems.push(`boss ${boss.id}: levelCap ${boss.levelCap} does not match ace level ${ace}`);
  }

  for (const [bossId, areaId] of Object.entries(pack.bossAreaCutoffs ?? {})) {
    if (!bossIds.has(bossId)) problems.push(`bossAreaCutoffs: unknown boss id: ${bossId}`);
    if (!areaIds.has(areaId)) problems.push(`bossAreaCutoffs: unknown area id: ${areaId}`);
  }
  return problems;
}

/** Bosses sorted in game order. */
export function sortedBosses(pack: GamePack) {
  return [...pack.bosses].sort((a, b) => a.order - b.order);
}

/** Areas sorted in game order. */
export function sortedAreas(pack: GamePack) {
  return [...pack.areas].sort((a, b) => a.order - b.order);
}
