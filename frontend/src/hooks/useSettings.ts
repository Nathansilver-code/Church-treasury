import { useCallback, useEffect, useState } from "react";
import { getSettings } from "../api";
import type { Settings } from "../api";

export const emptySettings: Settings = { churchName: "", address: "", treasurerName: "", currency: "UGX", receiptFooter: "" };

/** Loads the treasurer's settings (church name and so on) from the backend. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSettings(await getSettings());
    } catch {
      /* keep the defaults; the screen that needs them reports its own errors */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { settings, loaded, reload, setSettings };
}
