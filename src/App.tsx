import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type {
  Area, Boss, CaughtMon, EncounterOutcome, GamePack, MonStatus, Ruleset, Run, SpeciesData, StatKey,
} from "./engine/types";
import { PACKS, PLANNED_PACKS, getPack } from "./data/packs";
import { sortedAreas, sortedBosses, visibleStoryBosses } from "./engine/pack";
import {
  bossSegments, bossSlots, checkpoints, createRun, currentLevelCap, isDupe, nextBoss, overCapMembers, progressPercent,
} from "./engine/run";
import { teamCoverage } from "./engine/coverage";
import { NATURES, STAT_KEYS, STAT_LABELS, ivRange } from "./engine/iv";
import { buildPrepReport, type PrepCandidate } from "./engine/prep";
import { displayName, fetchEvolutions, useMoveTypes, useSpeciesData } from "./data/pokemon";
import { REGION_MAPS, SEGMENT_COLORS } from "./data/maps";
import { HOME_THEME, themeForPack, type PackTheme } from "./data/themes";
import type { EvolutionOption } from "./engine/evolution";
import { exportRunsJson, parseRunsJson, useRuns } from "./store";

const RULESET_LABELS: Record<Ruleset, string> = {
  casual: "Casual playthrough",
  nuzlocke: "Nuzlocke",
  hardcore: "Hardcore Nuzlocke",
};

export default function App() {
  const { runs, addRun, updateRun, deleteRun, importRuns } = useRuns();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRun = runs.find((r) => r.id === activeRunId) ?? null;

  // Opening or starting a run starts at the top of the page, not wherever
  // the previous view happened to be scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeRunId]);

  // One accent family per page, dark mode only: the home page is Lucario
  // blue on black; a run page takes its game's mascot accent. Overriding
  // --violet/--blue/--pink keeps every existing accent rule in one family
  // without touching each component.
  const theme = activeRun ? themeForPack(activeRun.packId) : HOME_THEME;
  return (
    <div
      className="app"
      style={{
        "--violet": theme.accent,
        "--violet-deep": theme.accentDeep,
        "--blue": theme.accentLight,
        "--pink": theme.accentLight,
      } as CSSProperties}
    >
      <ThemeSilhouette theme={theme} />
      <header className="topbar">
        <button className="brand" onClick={() => setActiveRunId(null)}>
          Run<span className="accent">Book</span>
        </button>
        <span className="tagline">Pokémon run logger + boss prep — base games & ROM hacks</span>
      </header>
      {activeRun ? (
        <RunView
          run={activeRun}
          onChange={updateRun}
          onBack={() => setActiveRunId(null)}
          onDelete={() => {
            deleteRun(activeRun.id);
            setActiveRunId(null);
          }}
        />
      ) : (
        <Home
          runs={runs}
          onOpen={setActiveRunId}
          onImport={importRuns}
          onCreate={(packId, ruleset, name) => {
            const run = createRun(packId, ruleset, name);
            addRun(run);
            setActiveRunId(run.id);
          }}
        />
      )}
      <footer className="footer">
        Fan-made, non-commercial tracker. Pokémon © Nintendo / Game Freak / Creatures Inc.
        Pack data is community-sourced — check each pack's sources. No ROMs or patches are hosted here.
        Runs are saved in this browser's local storage — export a backup from My runs to keep them safe.
      </footer>
    </div>
  );
}

/**
 * One large, faint silhouette fixed in the bottom-right corner, never
 * behind text and never interactive. Dark mode only: the artwork is
 * turned into a white silhouette (brightness 0 + invert) at 7% opacity,
 * so it reads as a shape on black rather than a coloured poster. The
 * official artwork URL needs the species id, which useSpeciesData loads
 * from PokéAPI; until it lands, nothing renders.
 */
function ThemeSilhouette({ theme }: { theme: PackTheme }) {
  const species = useSpeciesData([theme.mascot]);
  const data = species[theme.mascot];
  if (!data?.id) return null;
  return (
    <img
      className="theme-silhouette"
      src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${data.id}.png`}
      alt=""
      aria-hidden="true"
    />
  );
}

function Home({
  runs, onOpen, onCreate, onImport,
}: {
  runs: Run[];
  onOpen: (id: string) => void;
  onCreate: (packId: string, ruleset: Ruleset, name: string) => void;
  onImport: (runs: Run[]) => void;
}) {
  const [packId, setPackId] = useState(PACKS[0].id);
  const [ruleset, setRuleset] = useState<Ruleset>("nuzlocke");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ base: true, hack: true, fangame: false });
  const [closedGens, setClosedGens] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const matches = (n: string) => !q || n.toLowerCase().includes(q);

  const basePacks = PACKS.filter((p) => p.category === "base" && matches(p.name));
  const hackPacks = PACKS.filter((p) => p.category === "hack" && matches(p.name));
  const fanPacks = PACKS.filter((p) => p.category === "fangame" && matches(p.name));
  const hackPlanned = PLANNED_PACKS.filter((p) => p.kind === "hack" && matches(p.name));
  const fanPlanned = PLANNED_PACKS.filter((p) => p.kind === "fangame" && matches(p.name));
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
  const baseGens = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((gen) => ({ gen, packs: basePacks.filter((p) => p.generation === gen) }))
    .filter((g) => g.packs.length > 0);
  const categories = [
    { key: "base", title: "Base games", hasContent: basePacks.length > 0, count: `${basePacks.length} games` },
    { key: "hack", title: "ROM hacks", hasContent: hackPacks.length + hackPlanned.length > 0, count: `${hackPacks.length} playable · ${hackPlanned.length} planned` },
    { key: "fangame", title: "Fan games", hasContent: fanPacks.length + fanPlanned.length > 0, count: `${fanPlanned.length} planned` },
  ];
  const statusRank = (r: Run) => (r.status === "in-progress" ? 0 : r.status === "won" ? 1 : 2);
  const sortedRuns = [...runs].sort(
    (a, b) => statusRank(a) - statusRank(b) || b.createdAt.localeCompare(a.createdAt),
  );
  const [runsTab, setRunsTab] = useState<"open" | "won" | "wiped">("open");
  const runsByTab = {
    open: sortedRuns.filter((r) => r.status === "in-progress"),
    won: sortedRuns.filter((r) => r.status === "won"),
    wiped: sortedRuns.filter((r) => r.status === "wiped"),
  };

  const packCard = (pack: GamePack) => (
    <button
      key={pack.id}
      className={`pack-card ${pack.id === packId ? "selected" : ""}`}
      onClick={() => setPackId(pack.id)}
    >
      <strong>{pack.name}</strong>
      <span>
        {pack.category === "base" ? `Gen ${pack.generation} · ` : ""}
        {pack.areas.length} areas · {pack.bosses.length} bosses · data: {pack.dataQuality}
      </span>
    </button>
  );
  const plannedCard = (p: (typeof PLANNED_PACKS)[number]) => (
    <div key={p.name} className="pack-card planned">
      <strong>{p.name}</strong>
      <span>Pack coming soon · Tier {p.tier}</span>
    </div>
  );
  const toggleGen = (gen: number) =>
    setClosedGens((prev) => {
      const next = new Set(prev);
      if (next.has(gen)) next.delete(gen);
      else next.add(gen);
      return next;
    });

  const doExport = () => {
    const blob = new Blob([exportRunsJson(runs)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "runbook-runs.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    const imported = parseRunsJson(await file.text());
    if (imported.length === 0) {
      setImportMsg("That file didn't contain any RunBook runs.");
      return;
    }
    onImport(imported);
    setImportMsg(`Imported ${imported.length} run${imported.length === 1 ? "" : "s"}.`);
  };

  return (
    <main className="home">
      <section className="panel">
        <div className="runs-head">
          <h2>My runs</h2>
          <div className="runs-actions">
            <button className="ghost" onClick={doExport} disabled={runs.length === 0}>Export backup</button>
            <button className="ghost" onClick={() => fileRef.current?.click()}>Import backup</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImport(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        {runs.length === 0 ? (
          <p className="muted">No runs yet. Start one below.</p>
        ) : (
          <>
            <nav className="tabs runs-tabs">
              <button className={runsTab === "open" ? "tab active" : "tab"} onClick={() => setRunsTab("open")}>
                Open ({runsByTab.open.length})
              </button>
              {runsByTab.won.length > 0 && (
                <button className={runsTab === "won" ? "tab active" : "tab"} onClick={() => setRunsTab("won")}>
                  Won ({runsByTab.won.length})
                </button>
              )}
              <button className={runsTab === "wiped" ? "tab active" : "tab"} onClick={() => setRunsTab("wiped")}>
                Wiped ({runsByTab.wiped.length})
              </button>
            </nav>
            {importMsg && <p className="muted">{importMsg}</p>}
            <div className="run-list">
              {runsByTab[runsTab].map((run) => {
                const pack = getPack(run.packId);
                return (
                  <button key={run.id} className="run-card" onClick={() => onOpen(run.id)}>
                    <strong>{run.name}</strong>
                    <span>{pack?.name} · {RULESET_LABELS[run.ruleset]} · {run.status}</span>
                    <span>
                      {pack ? `${progressPercent(run, pack)}% checkpoints` : ""} · {run.team.length} Pokémon logged
                    </span>
                  </button>
                );
              })}
              {runsByTab[runsTab].length === 0 && (
                <p className="muted">
                  {runsTab === "open"
                    ? "No open runs. Start one below."
                    : runsTab === "wiped"
                      ? "No wiped runs. May it stay that way."
                      : "No won runs yet."}
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h2>New run</h2>
        <div className="new-run-form top">
          <label>
            Ruleset
            <select value={ruleset} onChange={(e) => setRuleset(e.target.value as Ruleset)}>
              {Object.entries(RULESET_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Run name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${getPack(packId)?.name ?? "Run"} — Attempt 1`}
            />
          </label>
          <button
            className="primary"
            onClick={() =>
              onCreate(packId, ruleset, name.trim() || `${getPack(packId)?.name} — Attempt 1`)
            }
          >
            Start run
          </button>
        </div>
        <label className="pack-search">
          Find a game
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search base games, ROM hacks, fan games…" />
        </label>
        {categories.map((cat) => {
          if (!cat.hasContent) return null;
          const open = q ? true : openCats[cat.key];
          return (
            <div key={cat.key} className={`category cat-${cat.key}`}>
              <button
                className="cat-toggle"
                onClick={() => setOpenCats((p) => ({ ...p, [cat.key]: !p[cat.key] }))}
              >
                <span className="chev">{open ? "▾" : "▸"}</span> {cat.title}
                <span className="muted">{cat.count}</span>
              </button>
              {open && cat.key === "base" && baseGens.map(({ gen, packs }) => {
                const gOpen = q ? true : !closedGens.has(gen);
                return (
                  <div key={gen} className="gen-group">
                    <button className="gen-toggle" onClick={() => toggleGen(gen)}>
                      <span className="chev">{gOpen ? "▾" : "▸"}</span> Generation {ROMAN[gen - 1]}
                      <span className="muted">{packs.length} game{packs.length === 1 ? "" : "s"}</span>
                    </button>
                    {gOpen && <div className="picker">{packs.map(packCard)}</div>}
                  </div>
                );
              })}
              {open && cat.key === "hack" && (
                <div className="picker">{hackPacks.map(packCard)}{hackPlanned.map(plannedCard)}</div>
              )}
              {open && cat.key === "fangame" && (
                <div className="picker">{fanPacks.map(packCard)}{fanPlanned.map(plannedCard)}</div>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}

type Tab = "timeline" | "map" | "story" | "routes" | "roster" | "prep" | "bosses";

function RunView({
  run, onChange, onBack, onDelete,
}: {
  run: Run;
  onChange: (run: Run) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const pack = getPack(run.packId) as GamePack;
  const [tab, setTab] = useState<Tab>("timeline");
  const [nextBossOpen, setNextBossOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const upcoming = nextBoss(run, pack);
  const cap = currentLevelCap(run, pack);
  const overCap = run.ruleset === "hardcore" ? overCapMembers(run, pack) : [];

  const bossSlugs = useMemo(
    () => [...pack.bosses, ...(pack.storyBosses ?? [])].flatMap((b) => b.team.map((m) => m.species)),
    [pack],
  );
  const teamSlugs = useMemo(() => run.team.map((m) => m.species), [run.team]);
  const species = useSpeciesData([...bossSlugs, ...teamSlugs]);

  const toggleBoss = (bossId: string) =>
    onChange({
      ...run,
      defeatedBossIds: run.defeatedBossIds.includes(bossId)
        ? run.defeatedBossIds.filter((id) => id !== bossId)
        : [...run.defeatedBossIds, bossId],
    });

  return (
    <main className="run-view">
      <div className="run-head">
        <button className="ghost" onClick={onBack}>← All runs</button>
        <div>
          <h2>{run.name}</h2>
          <div className="meta-badges">
            <span className="meta-badge ruleset">{RULESET_LABELS[run.ruleset]}</span>
            <span className="meta-badge">{pack.name}</span>
            <span className="meta-badge">Attempt {run.attempts}</span>
            <span className="meta-badge">🏅 {checkpoints(run, pack).done}/{checkpoints(run, pack).total} checkpoints</span>
            {cap !== null && run.ruleset !== "casual" && (
              <span className="meta-badge">Current cap {cap}</span>
            )}
          </div>
          <button className="pack-details-toggle" onClick={() => setDetailsOpen((v) => !v)}>
            <span className="chev">{detailsOpen ? "▾" : "▸"}</span> Pack details
          </button>
          {detailsOpen && (
            <div className="pack-details">
              {pack.notes && <p className="muted">{pack.notes}</p>}
              {pack.sourceDocs.length > 0 && (
                <p className="muted">Sources: {pack.sourceDocs.join(" · ")}</p>
              )}
            </div>
          )}
        </div>
        <div className="run-head-actions">
          {(() => {
            const starters = [...new Set((pack.storyBosses ?? []).map((b) => b.starterChoice).filter(Boolean))] as string[];
            return starters.length > 0 ? (
              <label className="muted">
                Starter{" "}
                <select
                  value={run.starter ?? ""}
                  onChange={(e) => onChange({ ...run, starter: e.target.value || undefined })}
                >
                  <option value="">All (show every rival variant)</option>
                  {starters.map((s) => (
                    <option key={s} value={s}>{displayName(s)}</option>
                  ))}
                </select>
              </label>
            ) : null;
          })()}
          <select
            value={run.status}
            onChange={(e) => onChange({ ...run, status: e.target.value as Run["status"] })}
          >
            <option value="in-progress">In progress</option>
            <option value="won">Won</option>
            <option value="wiped">Wiped</option>
          </select>
          <button className="ghost danger" onClick={onDelete}>Delete run</button>
        </div>
      </div>

      <div className="progress">
        <div className="progress-bar" style={{ width: `${progressPercent(run, pack)}%` }} />
        <span>{progressPercent(run, pack)}% of checkpoints cleared</span>
      </div>

      <div className="party-strip">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const mon = run.team.filter((m) => m.status === "party")[i];
          return (
            <div key={i} className={`party-slot ${mon ? "" : "empty"}`} title={mon ? `${mon.nickname || displayName(mon.species)} · Lv ${mon.level}` : "Empty slot"}>
              {mon && species[mon.species]?.sprite
                ? <img src={species[mon.species].sprite} alt={mon.species} />
                : null}
            </div>
          );
        })}
        <span className="muted">
          Party {run.team.filter((m) => m.status === "party").length}/6 · Box {run.team.filter((m) => m.status === "box").length} · Graveyard {run.team.filter((m) => m.status === "graveyard").length}
        </span>
      </div>

      {upcoming && (
        <section className="panel next-boss">
          <div className="boss-card-head">
            <BossPortrait boss={upcoming} species={species} size={48} />
            <button className="boss-name" onClick={() => setNextBossOpen((v) => !v)}>
              Next boss: {upcoming.name} <span className="chev">{nextBossOpen ? "▾" : "▸"}</span>
            </button>
            <span className="cap-badge">Level cap {upcoming.levelCap}</span>
          </div>
          <p className="muted">
            {upcoming.location}
            {cap !== null && run.ruleset !== "casual" ? ` · Your cap: ${cap}` : ""}
            {" · "}Click the boss name to peek at the team.
            {(() => {
              const slot = bossSlots(pack).find((s) => s.some((b) => b.id === upcoming.id)) ?? [];
              return slot.length > 1
                ? ` This checkpoint has ${slot.length} variants (${slot.map((b) => b.name).join(", ")}) — beating any one earns it.`
                : "";
            })()}
          </p>
          {nextBossOpen && <BossTeamGrid boss={upcoming} species={species} />}
          <button className="primary" onClick={() => toggleBoss(upcoming.id)}>Mark defeated</button>
          {overCap.length > 0 && (
            <p className="warning">
              Hardcore: over the level cap — {overCap.map((m) => `${m.nickname || displayName(m.species)} (Lv ${m.level})`).join(", ")}
            </p>
          )}
        </section>
      )}

      <nav className="tabs">
        {(["timeline", ...(REGION_MAPS[pack.id] ? ["map"] : []), "story", "routes", "roster", "prep", "bosses"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t === "timeline" ? "Timeline" : t === "map" ? "Map" : t === "story" ? "Story" : t === "routes" ? "Routes" : t === "roster" ? "Party & Box" : t === "prep" ? "Boss Prep" : "Bosses"}
          </button>
        ))}
      </nav>

      {tab === "map" && <MapTab run={run} pack={pack} species={species} onToggleBoss={toggleBoss} />}
      {tab === "story" && <StoryTab run={run} pack={pack} species={species} onToggleBoss={toggleBoss} />}
      {tab === "timeline" && (
        <TimelineTab run={run} pack={pack} species={species} onChange={onChange} onToggleBoss={toggleBoss} />
      )}
      {tab === "routes" && <RoutesTab run={run} pack={pack} />}
      {tab === "roster" && <RosterTab run={run} pack={pack} species={species} onChange={onChange} />}
      {tab === "prep" && <PrepTab run={run} pack={pack} species={species} />}
      {tab === "bosses" && (
        <section className="panel boss-list">
          {sortedBosses(pack).map((boss) => (
            <BossCard
              key={boss.id}
              boss={boss}
              species={species}
              defeated={run.defeatedBossIds.includes(boss.id)}
              onToggleBoss={toggleBoss}
            />
          ))}
          {pack.bosses.length === 0 && <p className="muted">Boss data for this pack is still being gathered.</p>}
        </section>
      )}
    </main>
  );
}

/** A boss's team, shown only when the player expands the boss card. */
function BossTeamGrid({ boss, species }: { boss: Boss; species: Record<string, SpeciesData> }) {
  return (
    <div className="boss-team">
      {boss.team.map((mon, i) => (
        <div key={i} className="boss-mon">
          {species[mon.species]?.sprite
            ? <img src={species[mon.species].sprite} alt={mon.species} width={56} height={56} />
            : <div className="sprite-placeholder" />}
          <span>{displayName(mon.species)}{mon.form ? ` (${mon.form})` : ""}</span>
          <span className="muted">Lv {mon.level}</span>
          {mon.ability && <span className="muted">{displayName(mon.ability)}</span>}
          {mon.item && <span className="muted">🎒 {displayName(mon.item)}</span>}
          {mon.moves.length > 0 && (
            <span className="muted moves">{mon.moves.map(displayName).join(", ")}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * The boss's own trainer portrait (public Showdown trainer sprite set,
 * keyed by the boss's first name). Bosses that aren't trainers (Totems,
 * Rogue Megas) or have no portrait fall back to their ace's sprite.
 */
const TRAINER_SLUG_ALIASES: Record<string, string> = { lt: "ltsurge", crasher: "crasherwake" };

function trainerSlug(name: string): string {
  const cleaned = name
    .replace(/^(gym leaders?|elite four|champion|kahuna|island kahuna|trial captain|captain|leader|frontier brain|pokémon trainer|pokemon trainer|trainer|rival|professor|boss)\s+/i, "")
    .trim();
  // Dual leaders fight as one boss: Showdown's sprite set has the pair
  // under the joined name, not under either twin alone. Without this,
  // "Gym Leaders Tate & Liza" cleaned to "gym" (the plural title was
  // not stripped) and fell back to the ace's sprite, Lunatone.
  if (/&/.test(cleaned)) {
    const parts = cleaned.split("&").map((p) => p.trim().toLowerCase().replace(/[^a-z]/g, ""));
    if (parts.length === 2 && parts[0] && parts[1]) return parts.join("and");
  }
  const first = (cleaned.split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  return TRAINER_SLUG_ALIASES[first] ?? first;
}

function BossPortrait({ boss, species, size }: { boss: Boss; species: Record<string, SpeciesData>; size: number }) {
  const [failedIdx, setFailedIdx] = useState(0);
  // Dual leaders: try the joined pair first, then each twin alone, then
  // the ace. A single failed Showdown URL must not drop straight to the
  // ace when another portrait candidate exists.
  const cleaned = boss.name
    .replace(/^(gym leaders?|elite four|champion|kahuna|island kahuna|trial captain|captain|leader|frontier brain|pokémon trainer|pokemon trainer|trainer|rival|professor|boss)\s+/i, "")
    .trim();
  const candidates = /&/.test(cleaned)
    ? [trainerSlug(boss.name), ...cleaned.split("&").map((p) => p.trim().toLowerCase().replace(/[^a-z]/g, ""))].filter(Boolean)
    : [trainerSlug(boss.name)].filter(Boolean);
  const slug = candidates[failedIdx];
  if (slug) {
    return (
      <img
        className="boss-ace trainer"
        src={`https://play.pokemonshowdown.com/sprites/trainers/${slug}.png`}
        alt={boss.name}
        width={size}
        height={size}
        onError={() => setFailedIdx((i) => i + 1)}
      />
    );
  }
  const ace = boss.team.reduce((a, b) => (b.level > a.level ? b : a), boss.team[0]);
  return ace && species[ace.species]?.sprite
    ? <img className="boss-ace" src={species[ace.species].sprite} alt={ace.species} width={size} height={size} />
    : <div className="sprite-placeholder small" />;
}

/** Cap-first boss card: name + location + level cap; click the name to reveal the team. */
function BossCard({
  boss, species, defeated, onToggleBoss, slotCleared,
}: {
  boss: Boss;
  species: Record<string, SpeciesData>;
  defeated: boolean;
  onToggleBoss: (bossId: string) => void;
  /** A variant sibling was beaten instead: this checkpoint is already earned. */
  slotCleared?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`boss-card ${defeated ? "defeated" : ""} ${slotCleared && !defeated ? "dimmed" : ""}`}>
      <div className="boss-card-head">
        <BossPortrait boss={boss} species={species} size={44} />
        <button className="boss-name" onClick={() => setOpen((v) => !v)}>
          {boss.name} <span className="chev">{open ? "▾" : "▸"}</span>
        </button>
        <span className="muted">{boss.location}</span>
        <span className="cap-badge">Lv cap {boss.levelCap}</span>
        {slotCleared && !defeated ? (
          <span className="chip done">Checkpoint cleared ✓</span>
        ) : (
          <button className={defeated ? "chip done" : "chip"} onClick={() => onToggleBoss(boss.id)}>
            {defeated ? "Defeated ✓" : "Mark defeated"}
          </button>
        )}
      </div>
      {open && <BossTeamGrid boss={boss} species={species} />}
    </div>
  );
}

/**
 * Picture-first species dropdown: native <select> popups can't render
 * images, so this is a custom menu where each option shows the Pokémon's
 * sprite next to its name.
 */
function SpeciesPicker({
  options, value, species, onChange,
}: {
  options: { species: string; form?: string | null }[];
  value: string;
  species: Record<string, SpeciesData>;
  onChange: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.species === value);
  const spriteImg = (slug: string, size: number) =>
    species[slug]?.sprite
      ? <img src={species[slug].sprite} alt="" width={size} height={size} />
      : <span className="sprite-dot" style={{ width: size, height: size }} />;
  return (
    <div className="species-picker">
      <button type="button" className="picker-btn" onClick={() => setOpen((v) => !v)}>
        {spriteImg(value, 30)}
        <span className="picker-label">
          {displayName(value)}{selected?.form ? ` (${selected.form})` : ""}
        </span>
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <>
          <div className="picker-backdrop" onClick={() => setOpen(false)} />
          <div className="picker-menu">
            {options.map((o) => (
              <button
                key={o.species + (o.form ?? "")}
                type="button"
                className={`picker-option ${o.species === value ? "selected" : ""}`}
                onClick={() => { onChange(o.species); setOpen(false); }}
              >
                {spriteImg(o.species, 36)}
                <span>{displayName(o.species)}{o.form ? ` (${o.form})` : ""}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type AreaDraft = { species: string; outcome: EncounterOutcome; level: number; nickname: string };

/**
 * Story: a read-only overview of the whole run's story progression —
 * every boss in order (gym leaders, Kahunas/trials, Elite Four, Champion,
 * and post-league bosses like Red/N/Ghetsis), with the areas you can
 * catch in before each one, and a League & postgame tail at the end.
 * Unlike Timeline, this is not for logging; unlike Bosses, it shows
 * bosses in story order with their segments, including league bosses
 * that get no timeline segment of their own.
 */
/**
 * Schematic region map (pilot: Emerald only). The journey path runs
 * through areas in story order, coloured one colour per gym leg; gym
 * bosses are large rings, story bosses are diamonds, logged areas are
 * filled, and the next unlogged area gets a white ring. The map is an
 * overview — logging still happens in the Timeline — so clicking a node
 * shows its detail below the map. Postgame trailing areas are not on
 * the path yet. Coordinates are hand-placed approximations, not to scale.
 */
function MapTab({
  run, pack, species, onToggleBoss,
}: {
  run: Run;
  pack: GamePack;
  species: Record<string, SpeciesData>;
  onToggleBoss: (bossId: string) => void;
}) {
  const map = REGION_MAPS[pack.id];
  const [selected, setSelected] = useState<
    | { kind: "area"; area: Area }
    | { kind: "boss"; boss: Boss }
    | { kind: "story"; bosses: Boss[] }
    | null
  >(null);
  if (!map) return <section className="panel"><p className="muted">No map for this game yet.</p></section>;
  const { segments } = bossSegments(pack, sortedAreas(pack));
  // One path leg per gym checkpoint (variants sharing an order collapse).
  const legs: { boss: Boss; areas: Area[]; color: string }[] = [];
  for (const seg of segments) {
    if (seg.areas.length === 0) continue;
    const last = legs[legs.length - 1];
    if (last && last.boss.order === seg.boss.order) last.areas.push(...seg.areas);
    else legs.push({ boss: seg.boss, areas: [...seg.areas], color: SEGMENT_COLORS[legs.length % SEGMENT_COLORS.length] });
  }
  const legOfArea = new Map<string, string>();
  legs.forEach((leg) => leg.areas.forEach((a) => legOfArea.set(a.id, leg.color)));
  const logged = (areaId: string) => run.encounters.find((e) => e.areaId === areaId);
  const pathAreas = legs.flatMap((leg) => leg.areas);
  const nextArea = pathAreas.find((a) => !logged(a.id));
  const bossPoint = (boss: Boss, leg: { areas: Area[] }) => {
    if (map.bosses[boss.id]) return map.bosses[boss.id];
    const last = leg.areas[leg.areas.length - 1];
    return last ? map.areas[last.id] : undefined;
  };
  // Story bosses grouped by their map point (rival variants share one).
  const storyGroups = new Map<string, Boss[]>();
  for (const sb of visibleStoryBosses(pack, run.starter)) {
    const pt = map.story[sb.id];
    if (!pt) continue;
    const key = `${pt.x},${pt.y}`;
    storyGroups.set(key, [...(storyGroups.get(key) ?? []), sb]);
  }
  const isCity = (a: Area) => /town|city/i.test(a.name);
  return (
    <section className="panel">
      <p className="muted">
        Your journey through Hoenn, in story order. Each leg is coloured by the gym it leads to;
        tap a node for its detail. Hand-drawn region outline, not the in-game map — postgame areas aren't on the path yet.
      </p>
      <svg viewBox="0 0 1000 700" width="100%" style={{ background: "#0a1a26", borderRadius: 8, position: "relative", zIndex: 2 }}>
        {/* Hand-drawn Hoenn outline (sea + mainland + islands) so the journey
            reads as a region, not lines on black. Not the in-game map. */}
        <rect x={0} y={0} width={1000} height={700} fill="#0a1a26" />
        <polygon
          points="140,300 170,220 260,160 420,170 560,190 640,240 700,320 730,430 680,480 580,470 480,480 400,520 340,580 260,600 180,560 140,480 140,380"
          fill="#1e3d2b" stroke="#335c3f" strokeWidth={1.5}
        />
        {[
          { cx: 90, cy: 530, rx: 55, ry: 45 },
          { cx: 880, cy: 430, rx: 50, ry: 28 },
          { cx: 880, cy: 375, rx: 45, ry: 28 },
          { cx: 840, cy: 380, rx: 35, ry: 25 },
          { cx: 700, cy: 540, rx: 40, ry: 28 },
          { cx: 400, cy: 500, rx: 35, ry: 25 },
          { cx: 420, cy: 620, rx: 40, ry: 18 },
        ].map((e, i) => (
          <ellipse key={i} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="#1e3d2b" stroke="#335c3f" strokeWidth={1.5} />
        ))}
        <circle cx={720} cy={600} r={35} fill="#1e3d2b" stroke="#335c3f" strokeWidth={1.5} />
        {legs.map((leg) => {
          const pts = leg.areas.map((a) => map.areas[a.id]).filter(Boolean);
          const bp = bossPoint(leg.boss, leg);
          if (bp && (pts.length === 0 || pts[pts.length - 1] !== bp)) pts.push(bp);
          if (pts.length < 2) return null;
          return (
            <polyline
              key={leg.boss.id}
              points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={leg.color}
              strokeWidth={3}
              strokeLinejoin="round"
              opacity={0.85}
            />
          );
        })}
        {pathAreas.map((a) => {
          const pt = map.areas[a.id];
          if (!pt) return null;
          const color = legOfArea.get(a.id) ?? "#888";
          const isNext = nextArea?.id === a.id;
          const entry = logged(a.id);
          // Skip the city label where a gym star sits on the same point —
          // the boss label below names the place instead.
          const hasBossHere = legs.some((leg) => !map.bosses[leg.boss.id] && leg.areas[leg.areas.length - 1]?.id === a.id);
          return (
            <g key={a.id} onClick={() => setSelected({ kind: "area", area: a })} style={{ cursor: "pointer" }}>
              <circle cx={pt.x} cy={pt.y} r={isNext ? 11 : 8} fill={entry ? color : "#1a1a1a"} stroke={isNext ? "#fff" : color} strokeWidth={2}>
                <title>{a.name}</title>
              </circle>
              {isCity(a) && !hasBossHere && (
                <text x={pt.x + 12} y={pt.y + 4} fill="#ddd" fontSize={11} style={{ paintOrder: "stroke", stroke: "#0a1a26", strokeWidth: 3 }}>{a.name}</text>
              )}
            </g>
          );
        })}
        {legs.map((leg) => {
          const pt = bossPoint(leg.boss, leg);
          if (!pt) return null;
          const defeated = run.defeatedBossIds.includes(leg.boss.id);
          return (
            <g key={`boss-${leg.boss.id}`} onClick={() => setSelected({ kind: "boss", boss: leg.boss })} style={{ cursor: "pointer" }}>
              <circle cx={pt.x} cy={pt.y} r={15} fill={defeated ? leg.color : "#000"} stroke={leg.color} strokeWidth={3}>
                <title>{leg.boss.name}</title>
              </circle>
              <text x={pt.x} y={pt.y + 4} textAnchor="middle" fill={defeated ? "#000" : "#fff"} fontSize={11} fontWeight="bold">★</text>
              <text x={pt.x + 18} y={pt.y + 4} fill="#ddd" fontSize={11} style={{ paintOrder: "stroke", stroke: "#0a1a26", strokeWidth: 3 }}>{leg.boss.name}</text>
            </g>
          );
        })}
        {[...storyGroups.entries()].map(([key, bosses]) => {
          const [x, y] = key.split(",").map(Number);
          return (
            <g key={`story-${key}`} onClick={() => setSelected({ kind: "story", bosses })} style={{ cursor: "pointer" }}>
              <rect x={x - 6} y={y - 6} width={12} height={12} transform={`rotate(45 ${x} ${y})`} fill="#facc15" stroke="#000" strokeWidth={1}>
                <title>{bosses.map((b) => b.name).join(" / ")}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <p className="muted">
        ● filled = logged · ○ hollow = not logged yet · white ring = next area · ★ = gym boss · ◆ = story boss
        {nextArea ? ` · Next: ${nextArea.name}` : ""}
      </p>
      {selected?.kind === "area" && (() => {
        const entry = logged(selected.area.id);
        return (
          <div className="segment">
            <strong>{selected.area.name}</strong>
            <p className="muted">
              {entry
                ? `Logged: ${entry.species ? displayName(entry.species) : "no catch recorded"} (${entry.outcome})`
                : "Not logged yet — log it in the Timeline."}
              {" · "}Catchable here: {[...new Set(selected.area.encounters.map((e) => displayName(e.species)))].join(", ") || "—"}
            </p>
          </div>
        );
      })()}
      {selected?.kind === "boss" && (
        <div className="segment">
          <div className="boss-card-head">
            <BossPortrait boss={selected.boss} species={species} size={40} />
            <strong>{selected.boss.name}</strong>
            <span className="muted">{selected.boss.location} · Lv cap {selected.boss.levelCap}</span>
            <button
              className={`chip ${run.defeatedBossIds.includes(selected.boss.id) ? "done" : ""}`}
              onClick={() => onToggleBoss(selected.boss.id)}
            >
              {run.defeatedBossIds.includes(selected.boss.id) ? "✓ Defeated" : "Mark defeated"}
            </button>
          </div>
          <BossTeamGrid boss={selected.boss} species={species} />
        </div>
      )}
      {selected?.kind === "story" && (
        <div className="segment">
          {selected.bosses.map((sb) => (
            <div key={sb.id}>
              <div className="boss-card-head">
                <span aria-hidden="true">◆</span>
                <strong>{sb.name}</strong>
                <span className="muted">{sb.location} · Highest Lv {Math.max(...sb.team.map((m) => m.level))} · Team hidden</span>
              </div>
            </div>
          ))}
          <p className="muted">Story bosses don't affect checkpoints or level caps.</p>
        </div>
      )}
    </section>
  );
}

function StoryTab({
  run, pack, species, onToggleBoss,
}: {
  run: Run;
  pack: GamePack;
  species: Record<string, SpeciesData>;
  onToggleBoss: (bossId: string) => void;
}) {
  const { segments, trailing } = bossSegments(pack, sortedAreas(pack));
  const byBoss = new Map(segments.map((s) => [s.boss.id, s.areas]));
  // Story bosses interleave with gym bosses by order, but they are NOT
  // checkpoints: no defeated toggle, no level cap — just the fight and its
  // team. Rival variants sharing an order are one fight, so group them.
  type StoryItem = { order: number; gym?: Boss; story?: Boss[] };
  const items: StoryItem[] = sortedBosses(pack).map((boss) => ({ order: boss.order, gym: boss }));
  for (const sb of visibleStoryBosses(pack, run.starter)) {
    const existing = items.find((it) => it.story && it.order === sb.order);
    if (existing) existing.story!.push(sb);
    else items.push({ order: sb.order, story: [sb] });
  }
  items.sort((a, b) => a.order - b.order);
  let gymIndex = 0;
  return (
    <section className="panel">
      <p className="muted">
        The story in order. Areas listed under a boss are the ones you can catch in before that fight;
        areas after the last boss are league and postgame. Story bosses (rivals, team leaders) don't
        affect checkpoints or level caps, and their teams are hidden.
      </p>
      {items.map((item) => {
        if (item.story) {
          return (
            <div key={`story-${item.order}`} className="segment">
              <div className="boss-card-head">
                <strong>Story · {item.story[0].location}</strong>
                <span className="muted">Highest Lv {Math.max(...item.story.flatMap((b) => b.team.map((m) => m.level)))}</span>
              </div>
              {item.story.map((sb) => (
                <div key={sb.id} style={{ marginTop: 8 }}>
                  <div className="boss-card-head">
                    <span aria-hidden="true">◆</span>
                    <strong>{sb.name}</strong>
                    <span className="muted">Team hidden</span>
                  </div>
                </div>
              ))}
            </div>
          );
        }
        const boss = item.gym!;
        gymIndex += 1;
        const areas = byBoss.get(boss.id) ?? [];
        const defeated = run.defeatedBossIds.includes(boss.id);
        return (
          <div key={boss.id} className="segment">
            <div className="boss-card-head">
              <BossPortrait boss={boss} species={species} size={40} />
              <strong>{gymIndex}. {boss.name}</strong>
              <span className="muted">{boss.location} · Lv cap {boss.levelCap}</span>
              <button className={`chip ${defeated ? "done" : ""}`} onClick={() => onToggleBoss(boss.id)}>
                {defeated ? "✓ Defeated" : "Mark defeated"}
              </button>
            </div>
            <p className="muted">
              {areas.length === 0
                ? "No new areas before this fight."
                : `${areas.length} area${areas.length === 1 ? "" : "s"}: ${areas.map((a) => a.name).join(", ")}`}
            </p>
          </div>
        );
      })}
      {trailing.length > 0 && (
        <div className="segment">
          <h4 className="segment-heading">League &amp; postgame</h4>
          <p className="muted">{trailing.map((a) => a.name).join(", ")}</p>
        </div>
      )}
    </section>
  );
}

function TimelineTab({
  run, pack, species, onChange, onToggleBoss,
}: {
  run: Run;
  pack: GamePack;
  species: Record<string, SpeciesData>;
  onChange: (r: Run) => void;
  onToggleBoss: (bossId: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, AreaDraft>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSpecies, setCustomSpecies] = useState("");
  const [customLevel, setCustomLevel] = useState(5);

  const packAreas = sortedAreas(pack);
  const customAreas = run.customAreas ?? [];
  // Sprites for every species in this pack's pools, for the picture picker
  // (cached in localStorage by the hook, so repeat visits are instant).
  const poolSlugs = useMemo(
    () => [...new Set([...packAreas, ...customAreas].flatMap((a) => a.encounters.map((e) => e.species)))],
    [pack, run.customAreas],
  );
  const poolSpecies = useSpeciesData(poolSlugs);
  const allSpecies = useMemo(() => ({ ...species, ...poolSpecies }), [species, poolSpecies]);
  const { segments, trailing } = bossSegments(pack, packAreas);
  // Bosses sharing an order slot are variants of one checkpoint (the
  // Striaton trio by starter, Drayden/Iris by version, Bea/Allister…):
  // render them as one group instead of separate timeline stops.
  const groups: { areas: Area[]; bosses: Boss[] }[] = [];
  for (const seg of segments) {
    const last = groups[groups.length - 1];
    if (last && last.bosses[0].order === seg.boss.order) {
      last.areas.push(...seg.areas);
      last.bosses.push(seg.boss);
    } else {
      groups.push({ areas: [...seg.areas], bosses: [seg.boss] });
    }
  }

  // Story bosses as timeline markers: grouped by order (rival variants
  // and the Mossdeep pair share one), rendered after the gym segment
  // they follow and before the next one. Display-only, like in Story.
  const storyGroups: { order: number; bosses: Boss[] }[] = [];
  for (const sb of visibleStoryBosses(pack, run.starter)) {
    const last = storyGroups[storyGroups.length - 1];
    if (last && last.order === sb.order) last.bosses.push(sb);
    else storyGroups.push({ order: sb.order, bosses: [sb] });
  }
  const storyMarker = (sg: { order: number; bosses: Boss[] }) => (
    <div key={`story-${sg.order}`} className="segment">
      <div className="segment-head">
        <span>Story boss · {sg.bosses[0].location}</span>
        <span className="muted">Highest Lv {Math.max(...sg.bosses.flatMap((b) => b.team.map((m) => m.level)))}</span>
      </div>
      {sg.bosses.map((sb) => (
        <div key={sb.id}>
          <div className="boss-card-head">
            <span aria-hidden="true">◆</span>
            <strong>{sb.name}</strong>
            <span className="muted">Team hidden</span>
          </div>
        </div>
      ))}
    </div>
  );

  const logged = (areaId: string) => run.encounters.find((e) => e.areaId === areaId);

  const log = (areaId: string) => {
    const d = draft[areaId];
    if (!d?.species) return;
    const existing = logged(areaId);
    let team = run.team;
    let monUid: string | undefined;
    if (existing?.monUid && team.some((m) => m.uid === existing.monUid)) {
      // Re-logging an area updates the SAME Pokémon in place (or removes
      // it if the outcome is no longer a catch), never a duplicate.
      if (d.outcome === "caught") {
        monUid = existing.monUid;
        team = team.map((m) =>
          m.uid === monUid
            ? { ...m, species: d.species, level: d.level || m.level, nickname: d.nickname || undefined }
            : m,
        );
      } else {
        team = team.filter((m) => m.uid !== existing.monUid);
      }
    } else if (d.outcome === "caught") {
      const partyCount = run.team.filter((m) => m.status === "party").length;
      const mon: CaughtMon = {
        uid: `mon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        species: d.species,
        nickname: d.nickname || undefined,
        level: d.level || 5,
        status: partyCount < 6 ? "party" : "box",
        caughtAreaId: areaId,
      };
      monUid = mon.uid;
      team = [...team, mon];
    }
    onChange({
      ...run,
      team,
      encounters: [
        ...run.encounters.filter((e) => e.areaId !== areaId),
        { areaId, outcome: d.outcome, species: d.species, monUid },
      ],
    });
  };

  const addCustomArea = () => {
    const speciesList = customSpecies
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(Boolean);
    if (!customName.trim() || speciesList.length === 0) return;
    const slug = customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    onChange({
      ...run,
      customAreas: [
        ...customAreas,
        {
          id: `custom-${slug}-${Date.now().toString(36)}`,
          name: customName.trim(),
          order: 100000 + customAreas.length,
          encounters: speciesList.map((s) => ({
            species: s, minLevel: customLevel, maxLevel: customLevel, methods: ["custom"],
          })),
        },
      ],
    });
    setCustomName("");
    setCustomSpecies("");
    setFormOpen(false);
  };

  const areaRow = (area: Area) => {
    const entry = logged(area.id);
    // The row reflects the encounter AS IT IS NOW: the linked Pokémon's
    // current species/level/nickname (evolutions included), falling back
    // to what was recorded at catch time.
    const mon = entry?.monUid ? run.team.find((m) => m.uid === entry.monUid) : undefined;
    const shownSpecies = mon?.species ?? entry?.species;
    const dupes = entry?.outcome === "caught" && shownSpecies
      ? isDupe({ ...run, team: run.team.filter((m) => m.uid !== entry.monUid) }, shownSpecies)
      : false;
    const toggleRow = (open: boolean) =>
      setExpandedRows((prev) => {
        const next = new Set(prev);
        if (open) next.add(area.id); else next.delete(area.id);
        return next;
      });

    if (entry && !expandedRows.has(area.id)) {
      return (
        <div key={area.id} className="area-row logged compact">
          <button className="row-toggle" onClick={() => toggleRow(true)} aria-label={`Edit encounter for ${area.name}`}>▸</button>
          <strong>{area.name}</strong>
          <span className={`outcome outcome-${entry.outcome}`}>
            {entry.outcome}: {shownSpecies ? displayName(shownSpecies) : ""}
            {mon?.nickname ? ` “${mon.nickname}”` : ""}
            {dupes ? " · dupes clause applies" : ""}
          </span>
          {mon && <span className="muted">Lv {mon.level} · {mon.status}</span>}
          <button className="ghost row-edit" onClick={() => toggleRow(true)}>Edit</button>
        </div>
      );
    }

    const d: AreaDraft = draft[area.id] ?? {
      species: shownSpecies ?? area.encounters[0]?.species ?? "",
      outcome: entry?.outcome ?? "caught",
      level: mon?.level ?? area.encounters[0]?.minLevel ?? 5,
      nickname: mon?.nickname ?? "",
    };
    const set = (patch: Partial<AreaDraft>) =>
      setDraft((prev) => ({ ...prev, [area.id]: { ...d, ...patch } }));
    const inPool = area.encounters.some((e) => e.species === d.species);
    return (
      <div key={area.id} className={`area-row ${entry ? "logged" : ""}`}>
        <div className="area-main">
          <strong>{area.name}</strong>
          <span className="muted pool">
            {area.encounters.slice(0, 8).map((e) => displayName(e.species)).join(", ")}
            {area.encounters.length > 8 ? ` +${area.encounters.length - 8} more` : ""}
          </span>
          {entry && (
            <span className={`outcome outcome-${entry.outcome}`}>
              {entry.outcome}: {shownSpecies ? displayName(shownSpecies) : ""}
              {dupes ? " · dupes clause applies" : ""}
            </span>
          )}
        </div>
        <div className="area-form">
          {(() => {
            const seen = new Set<string>();
            const pickerOptions = area.encounters
              .filter((e) => {
                const k = e.species + "|" + (e.form ?? "");
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
              })
              .map((e) => ({ species: e.species, form: e.form }));
            if (!inPool && d.species) pickerOptions.unshift({ species: d.species, form: "current" });
            return (
              <SpeciesPicker
                options={pickerOptions}
                value={d.species}
                species={allSpecies}
                onChange={(slug) => set({ species: slug })}
              />
            );
          })()}
          <select value={d.outcome} onChange={(e) => set({ outcome: e.target.value as EncounterOutcome })}>
            <option value="caught">Caught</option>
            <option value="missed">Missed</option>
            <option value="fainted">Fainted</option>
            <option value="skipped">Skipped</option>
          </select>
          {d.outcome === "caught" ? (
            <>
              <input type="number" min={1} max={100} value={d.level} onChange={(e) => set({ level: Number(e.target.value) })} aria-label="Level" />
              <input value={d.nickname} onChange={(e) => set({ nickname: e.target.value })} placeholder="Nickname" />
            </>
          ) : (
            <>
              <span />
              <span />
            </>
          )}
          <button
            className="primary"
            onClick={() => { log(area.id); if (entry) toggleRow(false); }}
            disabled={!d.species}
          >
            {entry ? "Update" : "Log"}
          </button>
          {entry && (
            <button className="ghost row-fold" onClick={() => toggleRow(false)} title="Collapse this encounter">▾</button>
          )}
        </div>
      </div>
    );
  };

  const nextArea = [...packAreas, ...customAreas].find((a) => !logged(a.id));
  const nextUndefeated = sortedBosses(pack).find((b) => !run.defeatedBossIds.includes(b.id));

  // Segments fold so the timeline stays navigable: beaten segments fold
  // automatically (for variant groups, beating any one variant counts),
  // and the player can fold/expand any segment manually.
  const [foldOverride, setFoldOverride] = useState<Record<string, boolean>>({});
  const groupKey = (g: { bosses: Boss[] }) => g.bosses.map((b) => b.id).join("+");
  const isFolded = (g: { areas: Area[]; bosses: Boss[] }) => {
    const key = groupKey(g);
    if (key in foldOverride) return foldOverride[key];
    return g.bosses.some((b) => run.defeatedBossIds.includes(b.id));
  };
  return (
    <section className="panel timeline">
      {nextArea ? (
        <p className="continue-banner">Continue at <span className="accent">{nextArea.name}</span> →</p>
      ) : nextUndefeated ? (
        <p className="continue-banner">All encounters logged — next up: <span className="accent">{nextUndefeated.name}</span> →</p>
      ) : null}
      {groups.length > 0 && storyGroups.filter((sg) => sg.order < groups[0].bosses[0].order).map(storyMarker)}
      {groups.map((g, gi) => {
        const folded = isFolded(g);
        const loggedCount = g.areas.filter((a) => logged(a.id)).length;
        const nextOrder = gi + 1 < groups.length ? groups[gi + 1].bosses[0].order : Infinity;
        return (
        <div key={gi} style={{ borderLeft: `3px solid ${SEGMENT_COLORS[gi % SEGMENT_COLORS.length]}`, paddingLeft: 12 }}>
        <div className="segment">
          {g.areas.length > 0 && (
            <div className="segment-head">
              <button
                className="segment-toggle"
                onClick={() => setFoldOverride((p) => ({ ...p, [groupKey(g)]: !folded }))}
              >
                <span className="chev">{folded ? "▸" : "▾"}</span>
                {" "}{g.areas.length} route{g.areas.length === 1 ? "" : "s"} before {g.bosses.map((b) => b.name).join(" / ")}
              </button>
              <span className="muted">{loggedCount}/{g.areas.length} logged</span>
            </div>
          )}
          {!folded && g.areas.map(areaRow)}
          {g.bosses.length === 1 ? (
            <BossCard
              boss={g.bosses[0]}
              species={species}
              defeated={run.defeatedBossIds.includes(g.bosses[0].id)}
              onToggleBoss={onToggleBoss}
            />
          ) : (
            <div className="variant-group">
              <span className="variant-label">You fight one of these — depends on your version / starter</span>
              {g.bosses.map((b) => (
                <BossCard
                  key={b.id}
                  boss={b}
                  species={species}
                  defeated={run.defeatedBossIds.includes(b.id)}
                  onToggleBoss={onToggleBoss}
                  slotCleared={g.bosses.some((x) => run.defeatedBossIds.includes(x.id))}
                />
              ))}
            </div>
          )}
        </div>
        {storyGroups.filter((sg) => sg.order > g.bosses[0].order && sg.order < nextOrder).map(storyMarker)}
        </div>
        );
      })}
      {groups.length === 0 && storyGroups.map(storyMarker)}
      {segments.length === 0 && packAreas.map(areaRow)}
      {trailing.length > 0 && (
        <div className="segment">
          <h4 className="segment-heading">League &amp; postgame</h4>
          {trailing.map(areaRow)}
        </div>
      )}
      {customAreas.length > 0 && (
        <div className="segment">
          <h4 className="segment-heading">Your custom areas</h4>
          {customAreas.map(areaRow)}
        </div>
      )}
      {packAreas.length === 0 && customAreas.length === 0 && (
        <p className="muted">This pack has no encounter table yet — add your own areas with the + button below to start logging.</p>
      )}
      <div className="add-area-row">
        <button className="add-area-btn" onClick={() => setFormOpen((v) => !v)} aria-label="Add your own area">
          +
        </button>
        <span className="muted">Add your own area</span>
      </div>
      {formOpen && (
        <div className="custom-area-form">
          <span className="muted">For places the pack doesn't list — name it, add the species you can catch there (comma-separated), and log it like any other area.</span>
          <div className="area-form">
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Area name (e.g. Safari Zone)" />
            <input value={customSpecies} onChange={(e) => setCustomSpecies(e.target.value)} placeholder="Species slugs (e.g. nidoran-f, exeggcute)" />
            <input type="number" min={1} max={100} value={customLevel} onChange={(e) => setCustomLevel(Number(e.target.value))} aria-label="Typical level" />
            <button className="primary" onClick={addCustomArea} disabled={!customName.trim() || !customSpecies.trim()}>
              Add area
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Evolution picker for one Pokémon: the real next forms from its
 * evolution chain, with sprites and how each evolution triggers.
 * Evolving patches the single mon record, so the party strip, box,
 * boss prep, and the route encounter row all update at once.
 */
function EvolvePanel({ mon, onEvolve }: { mon: CaughtMon; onEvolve: (species: string) => void }) {
  const [options, setOptions] = useState<EvolutionOption[] | null>(null);
  useEffect(() => {
    let live = true;
    setOptions(null);
    void fetchEvolutions(mon.species).then((o) => { if (live) setOptions(o); });
    return () => { live = false; };
  }, [mon.species]);
  const optData = useSpeciesData(options?.map((o) => o.species) ?? []);

  return (
    <div className="evolve-panel">
      {options === null && <p className="muted">Looking up evolutions…</p>}
      {options !== null && options.length === 0 && (
        <p className="muted">
          {displayName(mon.species)} has no further evolution in the reference data
          (final form, or a hack-original species). You can still set the species
          manually in the field above.
        </p>
      )}
      {options !== null && options.length > 0 && (
        <>
          <span className="muted">Evolve {mon.nickname || displayName(mon.species)} into:</span>
          <div className="evolve-options">
            {options.map((o) => (
              <button key={o.species} className="evolve-option" onClick={() => onEvolve(o.species)}>
                {optData[o.species]?.sprite
                  ? <img src={optData[o.species].sprite} alt="" width={44} height={44} />
                  : <span className="sprite-dot" style={{ width: 44, height: 44 }} />}
                <span className="evolve-name">{displayName(o.species)}</span>
                <span className="muted">{o.detail}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Full editor card for one Pokémon: nickname, species (evolution field),
 * level, status, Evolve and IV panels. Used by the party list and by the
 * box's selected-mon editor — one record, edited the same way everywhere.
 */
function MonEditorCard({
  mon, data, onPatch, onStatus, onLevel, onRemove,
}: {
  mon: CaughtMon;
  data: SpeciesData | undefined;
  onPatch: (uid: string, patch: Partial<CaughtMon>) => void;
  onStatus: (uid: string, status: MonStatus) => void;
  onLevel: (uid: string, level: number) => void;
  onRemove: (uid: string) => void;
}) {
  const [evoOpen, setEvoOpen] = useState(false);
  const [ivOpen, setIvOpen] = useState(false);
  return (
    <div className="mon-wrap">
      <div className="mon-card">
        {data?.sprite
          ? <img src={data.sprite} alt={mon.species} width={48} height={48} />
          : <div className="sprite-placeholder small" />}
        <div className="mon-info">
          <input
            className="nickname-input"
            value={mon.nickname ?? ""}
            placeholder={displayName(mon.species)}
            onChange={(e) => onPatch(mon.uid, { nickname: e.target.value || undefined })}
            aria-label="Nickname"
          />
          <span className="muted mon-species-line">
            <input
              className="species-input"
              key={mon.species}
              defaultValue={mon.species}
              title="Species — edit this when it evolves; the route encounter updates too"
              aria-label="Species"
              onBlur={(e) => {
                const slug = e.target.value.trim().toLowerCase().replace(/\s+/g, "-");
                if (slug && slug !== mon.species) onPatch(mon.uid, { species: slug });
                else e.target.value = mon.species;
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
            {" "}· Lv {mon.level}{mon.nature ? ` · ${mon.nature}` : ""}
          </span>
        </div>
        <input
          type="number" min={1} max={100} value={mon.level}
          onChange={(e) => onLevel(mon.uid, Number(e.target.value))} aria-label="Level"
        />
        <select value={mon.status} onChange={(e) => onStatus(mon.uid, e.target.value as MonStatus)}>
          <option value="party">Party</option>
          <option value="box">Box</option>
          <option value="graveyard">Graveyard</option>
        </select>
        <button className={`ghost ${evoOpen ? "iv-active" : ""}`} onClick={() => setEvoOpen((v) => !v)}>
          Evolve
        </button>
        <button className={`ghost ${ivOpen ? "iv-active" : ""}`} onClick={() => setIvOpen((v) => !v)}>
          IV
        </button>
        <button className="ghost danger" onClick={() => onRemove(mon.uid)}>✕</button>
      </div>
      {evoOpen && (
        <EvolvePanel
          mon={mon}
          onEvolve={(slug) => {
            onPatch(mon.uid, { species: slug });
            setEvoOpen(false);
          }}
        />
      )}
      {ivOpen && data && (
        <MonIvEditor mon={mon} data={data} onSave={(patch) => onPatch(mon.uid, patch)} />
      )}
    </div>
  );
}

function RosterTab({
  run, pack, species, onChange,
}: {
  run: Run;
  pack: GamePack;
  species: Record<string, SpeciesData>;
  onChange: (r: Run) => void;
}) {
  const [rosterTab, setRosterTab] = useState<MonStatus>("party");
  const [selectedBoxUid, setSelectedBoxUid] = useState<string | null>(null);
  const [selectedGraveUid, setSelectedGraveUid] = useState<string | null>(null);

  const byStatus = (status: MonStatus) => run.team.filter((m) => m.status === status);
  const party = byStatus("party");
  const box = byStatus("box");
  const graveyard = byStatus("graveyard");

  const partyData = party
    .map((m) => species[m.species])
    .filter((s): s is SpeciesData => Boolean(s));
  const coverage = partyData.length ? teamCoverage(partyData) : null;

  const patchMon = (uid: string, patch: Partial<CaughtMon>) =>
    onChange({ ...run, team: run.team.map((m) => (m.uid === uid ? { ...m, ...patch } : m)) });
  const setStatus = (uid: string, status: MonStatus) =>
    onChange({ ...run, team: run.team.map((m) => (m.uid === uid ? { ...m, status } : m)) });
  const setLevel = (uid: string, level: number) =>
    onChange({ ...run, team: run.team.map((m) => (m.uid === uid ? { ...m, level } : m)) });
  const remove = (uid: string) =>
    onChange({
      ...run,
      team: run.team.filter((m) => m.uid !== uid),
      encounters: run.encounters.map((e) => (e.monUid === uid ? { ...e, monUid: undefined } : e)),
    });

  const selectedBox = box.find((m) => m.uid === selectedBoxUid) ?? null;
  const selectedGrave = graveyard.find((m) => m.uid === selectedGraveUid) ?? null;
  const caughtAreaName = (mon: CaughtMon) => {
    const area = [...sortedAreas(pack), ...(run.customAreas ?? [])].find((a) => a.id === mon.caughtAreaId);
    return area?.name ?? null;
  };

  const pcTile = (
    mon: CaughtMon,
    selected: boolean,
    onSelect: () => void,
  ) => (
    <button key={mon.uid} className={`pc-slot ${selected ? "selected" : ""}`} onClick={onSelect}>
      {species[mon.species]?.sprite
        ? <img src={species[mon.species].sprite} alt={mon.species} />
        : <div className="sprite-placeholder small" />}
      <span className="pc-slot-name">{mon.nickname || displayName(mon.species)}</span>
      <span className="pc-slot-sub">{displayName(mon.species)} · Lv {mon.level}</span>
    </button>
  );

  return (
    <section className="panel">
      <nav className="tabs roster-tabs">
        {(["party", "box", "graveyard"] as MonStatus[]).map((s) => (
          <button
            key={s}
            className={rosterTab === s ? "tab active" : "tab"}
            onClick={() => setRosterTab(s)}
          >
            {s === "party" ? `Party (${party.length}/6)` : s === "box" ? `Box (${box.length})` : `Graveyard (${graveyard.length})`}
          </button>
        ))}
      </nav>

      {rosterTab === "party" && (
        <>
          <div className="party-list">
            {party.map((mon) => (
              <MonEditorCard
                key={mon.uid}
                mon={mon}
                data={species[mon.species]}
                onPatch={patchMon}
                onStatus={setStatus}
                onLevel={setLevel}
                onRemove={remove}
              />
            ))}
            {Array.from({ length: Math.max(0, 6 - party.length) }).map((_, i) => (
              <div key={i} className="empty-slot">
                <span className="empty-ball" />
                <span>Empty party slot</span>
              </div>
            ))}
          </div>
          {coverage && (
            <div className="coverage">
              <h4>Party coverage (by typing)</h4>
              <p>
                Offensive coverage: {Object.values(coverage.offensive).filter(Boolean).length} / 18 types
              </p>
              {coverage.uncoveredThreats.length > 0 ? (
                <p className="warning">
                  Uncovered threats: {coverage.uncoveredThreats.join(", ")} — a party member is weak to these
                  and nobody resists them.
                </p>
              ) : (
                <p className="muted">No uncovered threats by typing.</p>
              )}
            </div>
          )}
        </>
      )}

      {rosterTab === "box" && (
        <>
          {box.length === 0 && <p className="muted">The box is empty. Caught Pokémon beyond a full party land here.</p>}
          <div className="pc-grid">
            {box.map((mon) => pcTile(mon, mon.uid === selectedBoxUid, () =>
              setSelectedBoxUid(mon.uid === selectedBoxUid ? null : mon.uid)))}
          </div>
          {selectedBox && (
            <div className="box-detail">
              <MonEditorCard
                mon={selectedBox}
                data={species[selectedBox.species]}
                onPatch={patchMon}
                onStatus={setStatus}
                onLevel={setLevel}
                onRemove={remove}
              />
            </div>
          )}
          {box.length > 0 && !selectedBox && (
            <p className="muted pc-hint">Select a Pokémon to manage it — move it to the party, evolve it, or check its IVs.</p>
          )}
        </>
      )}

      {rosterTab === "graveyard" && (
        <div className="graveyard-view">
          <p className="muted grave-head">
            {graveyard.length === 0
              ? "No fallen friends yet. May it stay that way."
              : `Fallen — ${graveyard.length} ${graveyard.length === 1 ? "friend" : "friends"} remembered.`}
          </p>
          <div className="pc-grid graveyard-grid">
            {graveyard.map((mon) => (
              <button
                key={mon.uid}
                className={`pc-slot ${mon.uid === selectedGraveUid ? "selected" : ""}`}
                onClick={() => setSelectedGraveUid(mon.uid === selectedGraveUid ? null : mon.uid)}
              >
                {species[mon.species]?.sprite
                  ? <img src={species[mon.species].sprite} alt={mon.species} />
                  : <div className="sprite-placeholder small" />}
                <span className="pc-slot-name">{mon.nickname || displayName(mon.species)}</span>
              </button>
            ))}
          </div>
          {selectedGrave && (
            <div className="grave-detail">
              {species[selectedGrave.species]?.sprite
                ? <img src={species[selectedGrave.species].sprite} alt={selectedGrave.species} width={44} height={44} />
                : <div className="sprite-placeholder small" />}
              <div className="grave-info">
                <strong>{selectedGrave.nickname || displayName(selectedGrave.species)}</strong>
                <span className="muted">
                  {displayName(selectedGrave.species)} · Lv {selectedGrave.level}
                  {selectedGrave.nature ? ` · ${selectedGrave.nature}` : ""}
                  {caughtAreaName(selectedGrave) ? ` · caught at ${caughtAreaName(selectedGrave)}` : ""}
                </span>
              </div>
              <button className="ghost" onClick={() => setStatus(selectedGrave.uid, "box")}>
                Return to box
              </button>
              <button className="ghost danger" onClick={() => { remove(selectedGrave.uid); setSelectedGraveUid(null); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Per-Pokémon IV checker: enter the nature, the stats exactly as the game
 * shows them, and any EVs you know about (freshly caught = 0). The IV per
 * stat is solved live; at low levels it's an honest range that narrows as
 * the Pokémon levels up.
 */
function MonIvEditor({
  mon, data, onSave,
}: {
  mon: CaughtMon;
  data: SpeciesData;
  onSave: (patch: Partial<CaughtMon>) => void;
}) {
  const [nature, setNature] = useState(mon.nature ?? "");
  const [evs, setEvs] = useState<Record<StatKey, string>>(() =>
    Object.fromEntries(STAT_KEYS.map((k) => [k, String(mon.evs?.[k] ?? "")])) as Record<StatKey, string>,
  );
  const [stats, setStats] = useState<Record<StatKey, string>>(() =>
    Object.fromEntries(STAT_KEYS.map((k) => [k, String(mon.actualStats?.[k] ?? "")])) as Record<StatKey, string>,
  );

  const resultFor = (key: StatKey) => {
    const observed = parseInt(stats[key], 10);
    if (Number.isNaN(observed)) return null;
    return ivRange(data.baseStats[key], mon.level, parseInt(evs[key], 10) || 0, observed, key, nature || undefined);
  };

  const save = () => {
    const evOut: Partial<Record<StatKey, number>> = {};
    const statOut: Partial<Record<StatKey, number>> = {};
    for (const key of STAT_KEYS) {
      const ev = parseInt(evs[key], 10);
      if (!Number.isNaN(ev)) evOut[key] = Math.min(252, Math.max(0, ev));
      const st = parseInt(stats[key], 10);
      if (!Number.isNaN(st)) statOut[key] = st;
    }
    onSave({
      nature: nature || undefined,
      evs: Object.keys(evOut).length ? evOut : undefined,
      actualStats: Object.keys(statOut).length ? statOut : undefined,
    });
  };

  return (
    <div className="iv-editor">
      <div className="iv-head">
        <label>
          Nature
          <select value={nature} onChange={(e) => setNature(e.target.value)}>
            <option value="">Unknown</option>
            {NATURES.map((nat) => (
              <option key={nat.name} value={nat.name}>
                {nat.name}
                {nat.up ? ` (+${STAT_LABELS[nat.up]}, −${STAT_LABELS[nat.down as StatKey]})` : " (neutral)"}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">IVs solved at Lv {mon.level} — freshly caught Pokémon have 0 EVs.</span>
        <button className="primary" onClick={save}>Save</button>
      </div>
      <div className="iv-grid">
        {STAT_KEYS.map((key) => {
          const result = resultFor(key);
          const hasInput = stats[key] !== "";
          return (
            <div key={key} className="iv-cell">
              <span className="iv-stat-name">{STAT_LABELS[key]} <span className="muted">base {data.baseStats[key]}</span></span>
              <input
                type="number" min={0} max={999} placeholder="Stat"
                value={stats[key]} onChange={(e) => setStats((p) => ({ ...p, [key]: e.target.value }))}
                aria-label={`${STAT_LABELS[key]} actual stat`}
              />
              <input
                type="number" min={0} max={252} placeholder="EVs"
                value={evs[key]} onChange={(e) => setEvs((p) => ({ ...p, [key]: e.target.value }))}
                aria-label={`${STAT_LABELS[key]} EVs`}
              />
              <span className={`iv-result ${hasInput && !result ? "iv-bad" : ""}`}>
                {!hasInput ? "IV —" : result ? `IV ${result.min === result.max ? result.min : `${result.min}–${result.max}`}` : "no match"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="muted iv-note">
        "No match" means no IV produces that stat with this nature/EVs — usually a typo, the wrong nature, or untracked EVs from battles.
      </p>
    </div>
  );
}

/**
 * Boss Prep (Phase 2): counter scan of the logged party + box against a
 * selected boss — checks, walls, outspeeds, trap picks, threat list, and
 * an auto-generated prep checklist. Matchups are a STAB view by typing,
 * refined by the boss's recorded moves for trap detection; speed compares
 * estimated stats at each side's level (IV 15, neutral).
 */
function PrepTab({
  run, pack, species,
}: {
  run: Run;
  pack: GamePack;
  species: Record<string, SpeciesData>;
}) {
  const upcoming = nextBoss(run, pack);
  const [bossId, setBossId] = useState<string>(upcoming?.id ?? pack.bosses[0]?.id ?? "");
  const boss = pack.bosses.find((b) => b.id === bossId) ?? upcoming ?? pack.bosses[0];

  const segmentAreas = useMemo(() => {
    if (!boss) return [];
    const { segments } = bossSegments(pack, sortedAreas(pack));
    return segments.find((s) => s.boss.id === boss.id)?.areas ?? [];
  }, [pack, boss]);

  const poolSlugs = useMemo(
    () => [...new Set(segmentAreas.flatMap((a) => a.encounters.map((e) => e.species)))],
    [segmentAreas],
  );
  const poolSpecies = useSpeciesData(poolSlugs);
  const poolTypes = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [slug, data] of Object.entries(poolSpecies)) out[slug] = data.types;
    return out;
  }, [poolSpecies]);

  const moveTypes = useMoveTypes(boss ? boss.team.flatMap((m) => m.moves) : []);

  const report = useMemo(() => {
    if (!boss) return null;
    return buildPrepReport({
      boss,
      roster: run.team.filter((m) => m.status !== "graveyard"),
      species, moveTypes, segmentAreas, poolTypes,
    });
  }, [boss, run.team, species, moveTypes, segmentAreas, poolTypes]);

  if (!boss || !report) {
    return <section className="panel"><p className="muted">This pack has no boss data yet.</p></section>;
  }

  const candLine = (c: PrepCandidate) => (
    <li key={c.mon.uid} className="prep-cand">
      <strong>{c.mon.nickname || displayName(c.mon.species)}</strong>
      <span className="muted">
        {" "}({c.mon.status}, Lv {c.mon.level}) · hits ×{c.offense} · takes ×{c.defense}
        {c.outspeeds ? " · outspeeds" : ` · slower (${c.estSpeed} vs ${c.bossEstSpeed})`}
      </span>
    </li>
  );

  return (
    <section className="panel prep">
      <div className="prep-head">
        <label>
          Prep for
          <select value={boss.id} onChange={(e) => setBossId(e.target.value)}>
            {sortedBosses(pack).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.location} (cap {b.levelCap}){run.defeatedBossIds.includes(b.id) ? " ✓" : ""}
              </option>
            ))}
          </select>
        </label>
        <span className="cap-badge">Level cap {boss.levelCap}</span>
      </div>
      <BossTeamGrid boss={boss} species={species} />
      <p className="muted">
        Matchups use each side's own types (STAB view); traps also check the boss's recorded moves.
        Speed is estimated at each Pokémon's level (IV 15, neutral nature). Damage calculation is v2.
      </p>

      {report.threats.length > 0 && (
        <div className="prep-threats">
          <strong>⚠ Threat list:</strong>{" "}
          {report.threats.map((t) => displayName(t.bossMon.species) + (t.isAce ? " (ace)" : "")).join(", ")}
          {" "}— nothing available resists {report.threats.length === 1 ? "it" : "them"}.
        </div>
      )}
      {report.recommendedLead && (
        <p className="prep-lead">
          Suggested lead: <strong>{report.recommendedLead.mon.nickname || displayName(report.recommendedLead.mon.species)}</strong>
          {" "}into {displayName(report.recommendedLead.against.species)}.
        </p>
      )}

      {report.perMon.map((p) => (
        <div key={p.bossMon.species + p.bossMon.level} className="prep-mon">
          <div className="prep-mon-head">
            {p.data?.sprite
              ? <img src={p.data.sprite} alt={p.bossMon.species} width={44} height={44} />
              : <div className="sprite-placeholder small" />}
            <strong>{displayName(p.bossMon.species)}{p.bossMon.form ? ` (${p.bossMon.form})` : ""}</strong>
            <span className="muted">
              Lv {p.bossMon.level} · {p.data ? p.data.types.map(displayName).join(" / ") : "type data loading…"}
              {p.isAce ? " · ACE" : ""}
            </span>
            {p.threat && <span className="threat-tag">THREAT</span>}
          </div>
          {p.checks.length > 0 && (
            <>
              <h5>✅ Checks</h5>
              <ul className="prep-list">{p.checks.map(candLine)}</ul>
            </>
          )}
          {p.walls.length > 0 && (
            <>
              <h5>🧱 Walls</h5>
              <ul className="prep-list">{p.walls.map(candLine)}</ul>
            </>
          )}
          {p.traps.length > 0 && (
            <>
              <h5>⚠ Trap picks</h5>
              <ul className="prep-list">
                {p.traps.map((c) => (
                  <li key={c.mon.uid} className="prep-cand">
                    <strong>{c.mon.nickname || displayName(c.mon.species)}</strong>
                    <span className="muted"> ({c.mon.status}, Lv {c.mon.level}) — {c.trapReason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {p.checks.length === 0 && p.walls.length === 0 && (
            <p className="muted">
              No clean answers on your roster.
              {p.candidates.length > 0 && (
                <> Least-bad: {p.candidates[0].mon.nickname || displayName(p.candidates[0].mon.species)} (takes ×{p.candidates[0].defense}).</>
              )}
            </p>
          )}
          {p.threat && p.catchSuggestions.length > 0 && (
            <p className="prep-catch">
              Catch before this fight: {p.catchSuggestions.map((s) => `${displayName(s.species)} (${s.areaName})`).join(", ")}.
            </p>
          )}
        </div>
      ))}

      <div className="prep-checklist">
        <h4>Prep checklist</h4>
        <ul>
          {report.checklist.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      </div>
    </section>
  );
}

/**
 * Routes: a clean, read-only reference of every area's encounter table —
 * species, level range, and how it's encountered. Searchable by area or
 * species. Logging lives in the Timeline; this tab is the data view.
 */
function RoutesTab({ run, pack }: { run: Run; pack: GamePack }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const areas = [...sortedAreas(pack), ...(run.customAreas ?? [])].filter(
    (a) =>
      !query ||
      a.name.toLowerCase().includes(query) ||
      a.encounters.some((e) => e.species.includes(query)),
  );
  return (
    <section className="panel">
      <label className="pack-search">
        Find an area or species
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search routes, caves, species…" />
      </label>
      {areas.map((area) => (
        <div key={area.id} className="route-block">
          <h4>{area.name}{area.id.startsWith("custom-") ? " · custom" : ""}</h4>
          <div className="pool-grid">
            {area.encounters.map((e, i) => (
              <div key={e.species + (e.form ?? "") + i} className="pool-row">
                <span className="pool-name">{displayName(e.species)}{e.form ? ` (${e.form})` : ""}</span>
                <span className="pool-methods">{e.methods.map((m) => m.replace(/-/g, " ")).join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {areas.length === 0 && <p className="muted">No areas match that search.</p>}
    </section>
  );
}
