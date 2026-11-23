// where the game lives on this device. an unreadable save is never written over: it moves to a
// side slot first, and if it cannot be moved the game keeps playing without saving.
import { fromSave, toSave } from "../engine/save.ts";
import type { Game, Pack } from "../engine/types.ts";
import { tryReadSlot, writeSlot } from "./storage.ts";

export const SAVE_KEY = "lanternkeep:save";
export const KEPT_KEY = "lanternkeep:save:unreadable";
const MAX_KEPT = 20;

export interface Loaded {
  game: Game | null;
  /** there was a save here that this version cannot read. it is still safe */
  unreadable: boolean;
  /** the store would not even answer */
  blocked: boolean;
}

function keepAside(raw: string): boolean {
  for (let i = 0; i < MAX_KEPT; i++) {
    const key = i === 0 ? KEPT_KEY : `${KEPT_KEY}:${i}`;
    const there = tryReadSlot(key);
    if (there === undefined) return false;
    if (there === raw) return true;
    if (there === null) return writeSlot(key, raw);
  }
  return false;
}

export function createSaver(pack: Pack) {
  let unreadable: string | null = null;
  let blocked = false;
  let stopped = false;
  return {
    load(): Loaded {
      const raw = tryReadSlot(SAVE_KEY);
      if (raw === undefined) {
        // it may hold a real save we cannot see, so it is never written to
        blocked = true;
        return { game: null, unreadable: false, blocked: true };
      }
      if (raw === null) return { game: null, unreadable: false, blocked: false };
      const game = fromSave(pack, raw);
      if (game) return { game, unreadable: false, blocked: false };
      unreadable = raw;
      return { game: null, unreadable: true, blocked: false };
    },
    /** whether the game is really on the device after this */
    save(g: Game): boolean {
      if (blocked || stopped) return false;
      if (unreadable !== null) {
        if (!keepAside(unreadable)) return false;
        unreadable = null;
      }
      return writeSlot(SAVE_KEY, toSave(g));
    },
    /** another tab has the game now: this one stops writing so it cannot undo that tab's progress */
    stop() {
      stopped = true;
    },
    /** the unreadable save as text, for a grown-up to copy out */
    kept: () => unreadable ?? tryReadSlot(KEPT_KEY) ?? null,
  };
}
