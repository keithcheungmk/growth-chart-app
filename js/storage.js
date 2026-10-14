const STORAGE_KEY = "HK_GROWTH_DATA_V2";

const DEFAULT_STATE = {
  schemaVersion: 3,
  referenceStandard: "HK2020",
  currentProfileId: "kaka",
  profiles: {
    kaka: { id: "kaka", name: "卡卡", sex: "M", dateOfBirth: "2022-06-02", expectedDateOfConfinement: null, gestationalAgeWeeks: null, gestationalAgeDays: null, records: [{ id: "seed-kaka", date: "2026-09-24", lengthHeightCm: 106, measurementMethod: "standing", weightKg: null, headCircumferenceCm: null, notes: "示範記錄" }] },
    yuyu: { id: "yuyu", name: "浠榆", sex: "F", dateOfBirth: "2026-09-18", expectedDateOfConfinement: "2026-10-03", gestationalAgeWeeks: 37, gestationalAgeDays: 6, records: [{ id: "seed-yuyu", date: "2026-09-18", lengthHeightCm: 49.5, measurementMethod: "recumbent", weightKg: null, headCircumferenceCm: null, notes: "出生記錄" }] }
  }
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function makeId() { return globalThis.crypto?.randomUUID?.() || `record-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function parseOptionalNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}
function normalizeRecord(record) {
  const height = parseOptionalNumber(record.lengthHeightCm);
  const weight = parseOptionalNumber(record.weightKg);
  const head = parseOptionalNumber(record.headCircumferenceCm);
  return {
    id: String(record.id || makeId()),
    date: String(record.date || ""),
    lengthHeightCm: Number.isFinite(height) ? height : null,
    measurementMethod: record.measurementMethod === "recumbent" ? "recumbent" : "standing",
    weightKg: Number.isFinite(weight) ? weight : null,
    headCircumferenceCm: Number.isFinite(head) ? head : null,
    notes: String(record.notes || "").slice(0, 500)
  };
}
function inferGestationalAge(dateOfBirth, expectedDateOfConfinement) { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || !/^\d{4}-\d{2}-\d{2}$/.test(expectedDateOfConfinement)) return null; const birth = new Date(`${dateOfBirth}T00:00:00Z`); const edc = new Date(`${expectedDateOfConfinement}T00:00:00Z`); const daysBeforeDue = Math.round((edc - birth) / 86400000); const gestationalDays = 280 - daysBeforeDue; if (gestationalDays < 0 || gestationalDays > 320) return null; return { weeks: Math.floor(gestationalDays / 7), days: gestationalDays % 7 }; }
function displayNameFor(id, name) {
  const resolved = String(name || id);
  return id === "yuyu" && (resolved === "榆榆" || resolved === "曦悅") ? "浠榆" : resolved;
}
function normalizeState(value) {
  if (!value || typeof value !== "object" || !value.profiles) throw new Error("備份格式不正確");
  const profiles = {};
  for (const [id, profile] of Object.entries(value.profiles)) {
    if (!profile || !profile.dateOfBirth) throw new Error("兒童資料不完整");
    const dateOfBirth = String(profile.dateOfBirth);
    const expectedDateOfConfinement = profile.expectedDateOfConfinement ? String(profile.expectedDateOfConfinement) : null;
    const inferred = inferGestationalAge(dateOfBirth, expectedDateOfConfinement);
    profiles[id] = { id, name: displayNameFor(id, profile.name), sex: profile.sex === "F" ? "F" : "M", dateOfBirth, expectedDateOfConfinement, gestationalAgeWeeks: profile.gestationalAgeWeeks ?? inferred?.weeks ?? null, gestationalAgeDays: profile.gestationalAgeDays ?? inferred?.days ?? null, records: Array.isArray(profile.records) ? profile.records.map(normalizeRecord) : [] };
  }
  if (!Object.keys(profiles).length) throw new Error("備份沒有兒童資料");
  return { schemaVersion: 3, referenceStandard: "HK2020", currentProfileId: profiles[value.currentProfileId] ? value.currentProfileId : Object.keys(profiles)[0], profiles };
}

export function loadState() { try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? normalizeState(JSON.parse(saved)) : clone(DEFAULT_STATE); } catch { return clone(DEFAULT_STATE); } }
export function saveState(state) { const normalized = normalizeState(state); localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); return normalized; }
export function getStorageKey() { return STORAGE_KEY; }
export function exportState(state) { const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2); const blob = new Blob([payload], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "hk-growth-data-backup.json"; link.click(); URL.revokeObjectURL(url); }
export function importState(json) { return normalizeState(JSON.parse(json)); }
function validateRecordFields(profile, record) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) throw new Error("請輸入有效日期");
  const today = new Date().toISOString().slice(0, 10);
  if (record.date > today) throw new Error("量度日期不可晚於今天");
  if (record.date < profile.dateOfBirth) throw new Error("量度日期不可早於出生日期");
  const height = parseOptionalNumber(record.lengthHeightCm);
  const weight = parseOptionalNumber(record.weightKg);
  if (height == null && weight == null) throw new Error("請至少填寫身高或體重");
  if (height != null && (!Number.isFinite(height) || height < 35 || height > 230)) throw new Error("身高／身長必須介乎35至230厘米");
  if (weight != null && (!Number.isFinite(weight) || weight < 0.5 || weight > 150)) throw new Error("體重必須介乎0.5至150公斤");
  return {
    lengthHeightCm: Number.isFinite(height) ? height : null,
    weightKg: Number.isFinite(weight) ? weight : null
  };
}

export function addRecord(state, profileId, record) {
  const profile = state.profiles[profileId];
  if (!profile) throw new Error("找不到兒童檔案");
  const validated = validateRecordFields(profile, record);
  profile.records.push(normalizeRecord({ ...record, ...validated }));
  profile.records.sort((a, b) => a.date.localeCompare(b.date));
  return state;
}

export function updateRecord(state, profileId, recordId, record) {
  const profile = state.profiles[profileId];
  if (!profile) throw new Error("找不到兒童檔案");
  const index = profile.records.findIndex((entry) => entry.id === recordId);
  if (index < 0) throw new Error("找不到此記錄");
  const validated = validateRecordFields(profile, record);
  profile.records[index] = normalizeRecord({
    ...record,
    ...validated,
    id: recordId
  });
  profile.records.sort((a, b) => a.date.localeCompare(b.date));
  return state;
}

export function removeRecord(state, profileId, recordId) { const profile = state.profiles[profileId]; if (!profile) return state; profile.records = profile.records.filter((record) => record.id !== recordId); return state; }
