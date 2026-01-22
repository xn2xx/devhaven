import { invoke } from "@tauri-apps/api/core";

import type { HeatmapCacheFile } from "../models/heatmap";

export async function loadHeatmapCache(): Promise<HeatmapCacheFile> {
  return invoke<HeatmapCacheFile>("load_heatmap_cache");
}

export async function saveHeatmapCache(cache: HeatmapCacheFile): Promise<void> {
  await invoke("save_heatmap_cache", { cache });
}
