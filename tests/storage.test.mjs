import test from "node:test";
import assert from "node:assert/strict";
import { addRecord, importState, loadState, removeRecord, saveState } from "../js/storage.js";

function useMemoryStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("default profiles include the two children and their seeded records", () => {
  useMemoryStorage();
  const state = loadState();
  assert.equal(state.currentProfileId, "kaka");
  assert.equal(state.profiles.kaka.dateOfBirth, "2022-06-02");
  assert.equal(state.profiles.yuyu.expectedDateOfConfinement, "2026-10-03");
  assert.equal(state.profiles.kaka.records[0].lengthHeightCm, 106);
  assert.equal(state.profiles.yuyu.records[0].lengthHeightCm, 49.5);
});

test("older saved profiles infer birth week from birthday and due date", () => {
  useMemoryStorage();
  localStorage.setItem("HK_GROWTH_DATA_V2", JSON.stringify({ currentProfileId: "yuyu", profiles: { yuyu: { name: "榆榆", sex: "F", dateOfBirth: "2026-09-18", expectedDateOfConfinement: "2026-10-03", records: [] } } }));
  const state = loadState();
  assert.equal(state.profiles.yuyu.gestationalAgeWeeks, 37);
  assert.equal(state.profiles.yuyu.gestationalAgeDays, 6);
});

test("records persist optional measurements and remain chronologically sorted", () => {
  useMemoryStorage();
  const state = loadState();
  addRecord(state, "kaka", { date: "2026-09-20", lengthHeightCm: 105.2, measurementMethod: "standing", weightKg: "18.4", headCircumferenceCm: "51.2", notes: "放學後量度" });
  saveState(state);
  const restored = loadState();
  assert.deepEqual(restored.profiles.kaka.records.map((record) => record.date), ["2026-09-20", "2026-09-24"]);
  assert.equal(restored.profiles.kaka.records[0].weightKg, 18.4);
  assert.equal(restored.profiles.kaka.records[0].headCircumferenceCm, 51.2);
  assert.equal(restored.profiles.kaka.records[0].notes, "放學後量度");
});

test("records can be removed and imported after validation", () => {
  useMemoryStorage();
  const state = loadState();
  const recordId = state.profiles.kaka.records[0].id;
  removeRecord(state, "kaka", recordId);
  assert.equal(state.profiles.kaka.records.length, 0);
  const restored = importState(JSON.stringify(state));
  assert.equal(restored.profiles.kaka.records.length, 0);
  assert.throws(() => importState("{\"profiles\":{}}"), /備份沒有兒童資料/);
});
