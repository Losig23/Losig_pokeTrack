import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Area, Boss, CaughtMon, EncounterOutcome, GamePack, MonStatus, Ruleset, Run, SpeciesData, StatKey,
} from "./engine/types";
import { PACKS, PLANNED_PACKS, getPack } from "./data/packs";
import { sortedAreas, sortedBosses } from "./engine/pack";
import {
  bossSegments, createRun, currentLevelCap, isDupe, nextBoss, overCapMembers, progressPercent,
} from "./engine/run";
import { teamCoverage } from "./engine/coverage";
import { NATURES, STAT_KEYS, STAT_LABELS, ivRange } from "./engine/iv";
import { displayName, useSpeciesData } from "./data/pokemon";
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

  return (
    <div className="app">
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
  const ongoingCount = runs.filter((r) => r.status === "in-progress").length;

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
        <p className="muted">
          {runs.length === 0
            ? "No runs yet. Start one below."
            : `${ongoingCount} ongoing · ${runs.length} total — ongoing runs first.`}
        </p>
        {importMsg && <p className="muted">{importMsg}</p>}
        <div className="run-list">
          {sortedRuns.map((run) => {
            const pack = getPack(run.packId);
            return (
              <button key={run.id} className="run-card" onClick={() => onOpen(run.id)}>
                <strong>{run.name}</strong>
                <span>{pack?.name} · {RULESET_LABELS[run.ruleset]} · {run.status}</span>
                <span>
                  {pack ? `${progressPercent(run, pack)}% bosses` : ""} · {run.team.length} Pokémon logged
                </span>
              </button>
            );
          })}
        </div>
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

type Tab = "timeline" | "roster" | "bosses";

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
    () => pack.bosses.flatMap((b) => b.team.map((m) => m.species)),
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
        <span>{progressPercent(run, pack)}% of bosses defeated</span>
      </div>

      {upcoming && (
        <section className="panel next-boss">
          <div className="boss-card-head">
            <button className="boss-name" onClick={() => setNextBossOpen((v) => !v)}>
              Next boss: {upcoming.name} <span className="chev">{nextBossOpen ? "▾" : "▸"}</span>
            </button>
            <span className="cap-badge">Level cap {upcoming.levelCap}</span>
          </div>
          <p className="muted">
            {upcoming.location}
            {cap !== null && run.ruleset !== "casual" ? ` · Your cap: ${cap}` : ""}
            {" · "}Click the boss name to peek at the team.
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
        {(["timeline", "roster", "bosses"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t === "timeline" ? "Timeline" : t === "roster" ? "Party & Box" : "Bosses"}
          </button>
        ))}
      </nav>

      {tab === "timeline" && (
        <TimelineTab run={run} pack={pack} species={species} onChange={onChange} onToggleBoss={toggleBoss} />
      )}
      {tab === "roster" && <RosterTab run={run} species={species} onChange={onChange} />}
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

/** Cap-first boss card: name + location + level cap; click the name to reveal the team. */
function BossCard({
  boss, species, defeated, onToggleBoss,
}: {
  boss: Boss;
  species: Record<string, SpeciesData>;
  defeated: boolean;
  onToggleBoss: (bossId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`boss-card ${defeated ? "defeated" : ""}`}>
      <div className="boss-card-head">
        <button className="boss-name" onClick={() => setOpen((v) => !v)}>
          {boss.name} <span className="chev">{open ? "▾" : "▸"}</span>
        </button>
        <span className="muted">{boss.location}</span>
        <span className="cap-badge">Lv cap {boss.levelCap}</span>
        <button className={defeated ? "chip done" : "chip"} onClick={() => onToggleBoss(boss.id)}>
          {defeated ? "Defeated ✓" : "Mark defeated"}
        </button>
      </div>
      {open && <BossTeamGrid boss={boss} species={species} />}
    </div>
  );
}

type AreaDraft = { species: string; outcome: EncounterOutcome; level: number; nickname: string };

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
  const [formOpen, setFormOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSpecies, setCustomSpecies] = useState("");
  const [customLevel, setCustomLevel] = useState(5);

  const packAreas = sortedAreas(pack);
  const customAreas = run.customAreas ?? [];
  const { segments, trailing } = bossSegments(pack, packAreas);

  const logged = (areaId: string) => run.encounters.find((e) => e.areaId === areaId);

  const log = (areaId: string) => {
    const d = draft[areaId];
    if (!d?.species) return;
    let team = run.team;
    let monUid: string | undefined;
    if (d.outcome === "caught") {
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
    const d: AreaDraft = draft[area.id] ?? {
      species: area.encounters[0]?.species ?? "",
      outcome: "caught",
      level: area.encounters[0]?.minLevel ?? 5,
      nickname: "",
    };
    const set = (patch: Partial<AreaDraft>) =>
      setDraft((prev) => ({ ...prev, [area.id]: { ...d, ...patch } }));
    return (
      <div key={area.id} className="area-row">
        <div className="area-main">
          <strong>{area.name}</strong>
          <span className="muted pool">
            {area.encounters.slice(0, 8).map((e) => displayName(e.species)).join(", ")}
            {area.encounters.length > 8 ? ` +${area.encounters.length - 8} more` : ""}
          </span>
          {entry && (
            <span className={`outcome outcome-${entry.outcome}`}>
              {entry.outcome}: {entry.species ? displayName(entry.species) : ""}
              {entry.outcome === "caught" && entry.species && isDupe({ ...run, team: run.team.filter((m) => m.uid !== entry.monUid) }, entry.species)
                ? " · dupes clause applies"
                : ""}
            </span>
          )}
        </div>
        <div className="area-form">
          <select value={d.species} onChange={(e) => set({ species: e.target.value })}>
            {area.encounters.map((e) => (
              <option key={e.species + (e.form ?? "")} value={e.species}>
                {displayName(e.species)}{e.form ? ` (${e.form})` : ""} · Lv {e.minLevel}–{e.maxLevel}
              </option>
            ))}
          </select>
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
          <button className="primary" onClick={() => log(area.id)} disabled={!d.species}>
            {entry ? "Update" : "Log"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="panel timeline">
      {segments.map(({ boss, areas }) => (
        <div key={boss.id} className="segment">
          {areas.map(areaRow)}
          <BossCard
            boss={boss}
            species={species}
            defeated={run.defeatedBossIds.includes(boss.id)}
            onToggleBoss={onToggleBoss}
          />
        </div>
      ))}
      {segments.length === 0 && packAreas.map(areaRow)}
      {trailing.length > 0 && (
        <div className="segment">
          <h4 className="segment-heading">After the final boss</h4>
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

function RosterTab({
  run, species, onChange,
}: {
  run: Run;
  species: Record<string, SpeciesData>;
  onChange: (r: Run) => void;
}) {
  const party = run.team.filter((m) => m.status === "party");
  const partyData = party
    .map((m) => species[m.species])
    .filter((s): s is SpeciesData => Boolean(s));
  const coverage = partyData.length ? teamCoverage(partyData) : null;

  const [ivOpenUid, setIvOpenUid] = useState<string | null>(null);
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

  const column = (title: string, status: MonStatus) => (
    <div className="roster-col">
      <h4>{title}</h4>
      {run.team.filter((m) => m.status === status).map((mon) => (
        <div key={mon.uid} className="mon-wrap">
          <div className="mon-card">
            {species[mon.species]?.sprite
              ? <img src={species[mon.species].sprite} alt={mon.species} width={48} height={48} />
              : <div className="sprite-placeholder small" />}
            <div className="mon-info">
              <strong>{mon.nickname || displayName(mon.species)}</strong>
              <span className="muted">
                {displayName(mon.species)} · Lv {mon.level}{mon.nature ? ` · ${mon.nature}` : ""}
              </span>
            </div>
            <input
              type="number" min={1} max={100} value={mon.level}
              onChange={(e) => setLevel(mon.uid, Number(e.target.value))} aria-label="Level"
            />
            <select value={mon.status} onChange={(e) => setStatus(mon.uid, e.target.value as MonStatus)}>
              <option value="party">Party</option>
              <option value="box">Box</option>
              <option value="graveyard">Graveyard</option>
            </select>
            <button
              className={`ghost ${ivOpenUid === mon.uid ? "iv-active" : ""}`}
              onClick={() => setIvOpenUid(ivOpenUid === mon.uid ? null : mon.uid)}
            >
              IV
            </button>
            <button className="ghost danger" onClick={() => remove(mon.uid)}>✕</button>
          </div>
          {ivOpenUid === mon.uid && species[mon.species] && (
            <MonIvEditor
              mon={mon}
              data={species[mon.species]}
              onSave={(patch) => patchMon(mon.uid, patch)}
            />
          )}
        </div>
      ))}
      {run.team.filter((m) => m.status === status).length === 0 && <p className="muted">Empty</p>}
    </div>
  );

  return (
    <section className="panel">
      <div className="roster-grid">
        {column("Party", "party")}
        {column("Box", "box")}
        {column("Graveyard", "graveyard")}
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
            <p className="muted">No uncovered threats by typing. Boss-prep counter analysis arrives in Phase 2.</p>
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
