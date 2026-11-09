import fs from "fs";
import os from "os";
import path from "path";

export type EpisodeKey = "soil" | "temperature" | "humidity" | "hardware";

type Episode = { active: boolean; sending?: boolean; claimedAt?: number };

const stateFile = path.join(os.tmpdir(), "agrisense-live-alert-state.json");

function readState(): Partial<Record<EpisodeKey, Episode>> {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return {};
  }
}

function writeState(state: Partial<Record<EpisodeKey, Episode>>) {
  fs.writeFileSync(stateFile, JSON.stringify(state));
}

export function episodeKeyFrom(type: string, hazardType: string): EpisodeKey | null {
  if (type === "test") return null;
  const name = `${type} ${hazardType}`.toLowerCase();
  if (
    name.includes("hardware") ||
    name.includes("node") ||
    name.includes("disconnect") ||
    name.includes("reconnect")
  ) {
    return "hardware";
  }
  if (name.includes("soil") || name.includes("moisture")) return "soil";
  if (name.includes("temperature") || name.includes("heat") || name.includes("chill")) return "temperature";
  if (name.includes("humidity") || name.includes("aridity") || name.includes("fungal")) return "humidity";
  return null;
}

/** Returns true when this live condition should send one real email. */
export function claimEpisode(type: string, key: EpisodeKey): boolean {
  const state = readState();
  const row = state[key];
  const now = Date.now();
  if (row?.sending && row.claimedAt && now - row.claimedAt < 120_000) return false;

  const active = Boolean(row?.active);
  if (type === "recovery") {
    if (!active) return false;
    state[key] = { active: false, sending: true, claimedAt: now };
  } else {
    if (active) return false;
    state[key] = { active: true, sending: true, claimedAt: now };
  }
  writeState(state);
  return true;
}

export function finishEpisode(type: string, key: EpisodeKey) {
  const state = readState();
  state[key] = { active: type !== "recovery", sending: false };
  writeState(state);
}

export function releaseEpisode(type: string, key: EpisodeKey) {
  const state = readState();
  state[key] = { active: type === "recovery", sending: false };
  writeState(state);
}
