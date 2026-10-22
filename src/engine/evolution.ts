/**
 * Evolution options from a PokéAPI evolution-chain tree: given the chain
 * and a species, what does it evolve into next, and how (level, item,
 * trade…)? Pure functions over the chain JSON shape so they can be
 * unit-tested without the network.
 */

export interface EvolutionOption {
  species: string;
  /** Human-readable trigger, e.g. "Lv 16", "Use thunder stone", "Trade". */
  detail: string;
}

export interface EvoDetail {
  min_level: number | null;
  trigger: { name: string };
  item: { name: string } | null;
  held_item: { name: string } | null;
  min_happiness: number | null;
  time_of_day: string;
  min_beauty: number | null;
  location: { name: string } | null;
}

export interface ChainNode {
  species: { name: string };
  evolution_details: EvoDetail[];
  evolves_to: ChainNode[];
}

const humanize = (slug: string) =>
  slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function detailLabel(detail: EvoDetail | undefined): string {
  if (!detail) return "Level up";
  const parts: string[] = [];
  if (detail.min_level) parts.push(`Lv ${detail.min_level}+`);
  if (detail.item) parts.push(`Use ${humanize(detail.item.name)}`);
  if (detail.trigger.name === "trade") parts.push("Trade");
  if (detail.held_item) parts.push(`holding ${humanize(detail.held_item.name)}`);
  if (detail.min_happiness) parts.push("High friendship");
  if (detail.min_beauty) parts.push("High beauty");
  if (detail.location) parts.push(`at ${humanize(detail.location.name)}`);
  if (detail.time_of_day) parts.push(`(${detail.time_of_day})`);
  if (parts.length === 0) {
    return detail.trigger.name === "level-up" ? "Level up" : humanize(detail.trigger.name);
  }
  return parts.join(" · ");
}

function findNode(node: ChainNode, slug: string): ChainNode | null {
  if (node.species.name === slug) return node;
  for (const child of node.evolves_to) {
    const hit = findNode(child, slug);
    if (hit) return hit;
  }
  return null;
}

/** Direct next evolutions of `slug` within the chain (empty if final form / absent). */
export function nextEvolutions(chain: ChainNode, slug: string): EvolutionOption[] {
  const node = findNode(chain, slug);
  if (!node) return [];
  return node.evolves_to.map((child) => ({
    species: child.species.name,
    detail: detailLabel(child.evolution_details[0]),
  }));
}
