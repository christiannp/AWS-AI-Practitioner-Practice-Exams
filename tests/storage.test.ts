import { describe, expect, it } from "vitest";

import type { LearnerState } from "../src/data/types";
import {
  exportState,
  importState,
  loadState,
  resetState,
  saveState,
  STORAGE_KEY
} from "../src/state/storage";
import fixture from "./fixtures/state.json";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const validState = fixture as LearnerState;

describe("local learner-state persistence", () => {
  it("uses the editable August 31 target as the first-run default", () => {
    const result = loadState(new MemoryStorage());

    expect(result.state.settings.targetDate).toBe("2026-08-31");
    expect(result.state.attempts).toEqual({});
    expect(result.error).toBeUndefined();
  });

  it("round-trips attempts and in-progress answers", () => {
    const storage = new MemoryStorage();
    saveState(storage, validState);

    expect(loadState(storage).state).toEqual(validState);
  });

  it("recovers safely from corrupt local JSON without deleting it", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not valid json");

    const result = loadState(storage);

    expect(result.state.settings.targetDate).toBe("2026-08-31");
    expect(result.recoveryPayload).toBe("{not valid json");
    expect(result.error).toMatch(/corrupt|invalid/i);
    expect(storage.getItem(STORAGE_KEY)).toBe("{not valid json");
  });

  it("rejects unsupported versions and structurally invalid imports", () => {
    expect(() => importState('{"version":999}')).toThrow(/unsupported/i);
    expect(() => importState('{"version":1,"settings":{}}')).toThrow(
      /invalid/i
    );
  });

  it("exports and imports a readable lossless backup", () => {
    const json = exportState(validState);

    expect(json).toContain("\n");
    expect(importState(json)).toEqual(validState);
  });

  it("resets only this app's key", () => {
    const storage = new MemoryStorage();
    storage.setItem("another-app", "keep");
    saveState(storage, validState);

    const reset = resetState(storage);

    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem("another-app")).toBe("keep");
    expect(reset.settings.targetDate).toBe("2026-08-31");
  });
});
