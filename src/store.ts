import { useCallback, useEffect, useState } from "react";
import type { Run } from "./engine/types";

const KEY = "runbook-runs-v1";

function load(): Run[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Run[]) : [];
  } catch {
    return [];
  }
}

/** Serialize all runs for the JSON backup download. */
export function exportRunsJson(runs: Run[]): string {
  return JSON.stringify({ app: "RunBook", version: 1, runs }, null, 2);
}

/** Parse a backup file back into runs. Returns [] for anything malformed. */
export function parseRunsJson(text: string): Run[] {
  try {
    const data = JSON.parse(text) as { runs?: unknown } | unknown[];
    const list = Array.isArray(data) ? data : data.runs;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (r): r is Run =>
        typeof r === "object" && r !== null &&
        typeof (r as Run).id === "string" && typeof (r as Run).packId === "string" &&
        Array.isArray((r as Run).encounters) && Array.isArray((r as Run).team),
    );
  } catch {
    return [];
  }
}

/**
 * All runs, persisted to the browser's localStorage under this app's origin.
 * The data lives in the browser, not in the dev server — stopping
 * `npm run dev` does not touch it. It is per-browser and per-origin
 * (localhost:5173 and 127.0.0.1:5173 are separate stores), so use the
 * JSON export/import for backups or moving between browsers.
 */
export function useRuns() {
  const [runs, setRuns] = useState<Run[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(runs));
    } catch {
      // best-effort persistence
    }
  }, [runs]);

  const addRun = useCallback((run: Run) => setRuns((prev) => [run, ...prev]), []);
  const updateRun = useCallback(
    (updated: Run) =>
      setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r))),
    [],
  );
  const deleteRun = useCallback(
    (id: string) => setRuns((prev) => prev.filter((r) => r.id !== id)),
    [],
  );
  /** Merge imported runs in by id (an imported run replaces a local one with the same id). */
  const importRuns = useCallback((imported: Run[]) => {
    setRuns((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      for (const run of imported) byId.set(run.id, run);
      return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }, []);

  return { runs, addRun, updateRun, deleteRun, importRuns };
}
