import { invoke } from "@tauri-apps/api/core";
import type { SearchResult, RecentWeek } from "@/types/search";

export async function search(query: string): Promise<SearchResult[]> {
  return invoke("search", { query });
}

export async function getRecentWeeks(): Promise<RecentWeek[]> {
  return invoke("get_recent_weeks");
}
