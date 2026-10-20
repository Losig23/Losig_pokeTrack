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

/** All runs, persisted to localStorage (local-first; JSON export/import is a Phase 4 item). */
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

  return { runs, addRun, updateRun, deleteRun };
}
