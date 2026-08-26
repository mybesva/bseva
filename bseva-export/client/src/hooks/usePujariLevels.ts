import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PUJARI_LEVELS } from "@shared/pujariLevels";

export type PujariLevelRow = {
  id?: string;
  level: number;
  title: string;
  summary?: string;
  examples?: string[];
};

export function usePujariLevels() {
  const [levels, setLevels] = useState<PujariLevelRow[]>(PUJARI_LEVELS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api<PujariLevelRow[]>("/pujari-roles");
      if (rows?.length) setLevels(rows);
    } catch {
      setLevels(PUJARI_LEVELS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { levels, loading, reload };
}
