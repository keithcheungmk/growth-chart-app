const STORAGE_KEY = "HK_GROWTH_DATA_V2";

const DEFAULT_STATE = {
  schemaVersion: 2,
  referenceStandard: "HK2020",
  currentProfileId: "kaka",
  profiles: {
    kaka: { id: "kaka", name: "卡卡", sex: "M", dateOfBirth: "2022-06-02", expectedDateOfConfinement: null, gestationalAgeWeeks: null, gestationalAgeDays: null, records: [{ id: "seed-kaka", date: "2026-09-24", lengthHeightCm: 106, measurementMethod: "standing", weightKg: null, headCircumferenceCm: null, notes: "示範記錄" }] },
    yuyu: { id: "yuyu", name: "榆榆", sex: "F", dateOfBirth: "2026-09-18", expectedDateOfConfinement: "2026-10-03", gestationalAgeWeeks: 37, gestationalAgeDays: 6, records: [{ id: "seed-yuyu", date: "2026-09-18", lengthHeightCm: 49.5, measurementMethod: "recumbent", weightKg: null, headCircumferenceCm: null, notes: "出生記錄" }] }
  }
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function makeId() { return globalThis.crypto?.randomUUID?.() || `record-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function normalizeRecord(record) { return { id: String(record.id || makeId()), date: String(record.date || ""), lengthHeightCm: Number(record.lengthHeightCm), measurementMethod: record.measurementMethod === "recumbent" ? "recumbent" : "standing", weightKg: record.weightKg == null || record.weightKg === "" ? null : Number(record.weightKg), headCircumferenceCm: record.headCircumferenceCm == null || record.headCircumferenceCm === "" ? null : Number(record.headCircumferenceCm), notes: String(record.notes || "").slice(0, 500) }; }
function normalizeState(value) {
  if (!value || typeof value !== "object" || !value.profiles) throw new Error("備份格式不正確");
  const profiles = {};
  for (const [id, profile] of Object.entries(value.profiles)) {
    if (!profile || !profile.dateOfBirth) throw new Error("兒童資料不完整");
    profiles[id] = { id, name: String(profile.name || id), sex: profile.sex === "F" ? "F" : "M", dateOfBirth: String(profile.dateOfBirth), expectedDateOfConfinement: profile.expectedDateOfConfinement ? String(profile.expectedDateOfConfinement) : null, gestationalAgeWeeks: profile.gestationalAgeWeeks ?? null, gestationalAgeDays: profile.gestationalAgeDays ?? null, records: Array.isArray(profile.records) ? profile.records.map(normalizeRecord) : [] };
  }
  if (!Object.keys(profiles).length) throw new Error("備份沒有兒童資料");
  return { schemaVersion: 2, referenceStandard: "HK2020", currentProfileId: profiles[value.currentProfileId] ? value.currentProfileId : Object.keys(profiles)[0], profiles };
}

export function loadState() { try { const saved = localStorage.getItem(STORAGE_KEY); return saved ? normalizeState(JSON.parse(saved)) : clone(DEFAULT_STATE); } catch { return clone(DEFAULT_STATE); } }
export function saveState(state) { const normalized = normalizeState(state); localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); return normalized; }
export function getStorageKey() { return STORAGE_KEY; }
export function exportState(state) { const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2); const blob = new Blob([payload], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "hk-growth-data-backup.json"; link.click(); URL.revokeObjectURL(url); }
export function importState(json) { return normalizeState(JSON.parse(json)); }
export function addRecord(state, profileId, record) { const profile = state.profiles[profileId]; if (!profile) throw new Error("找不到兒童檔案"); if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) throw new Error("請輸入有效日期"); const today = new Date().toISOString().slice(0, 10); if (record.date > today) throw new Error("量度日期不可晚於今天"); if (record.date < profile.dateOfBirth) throw new Error("量度日期不可早於出生日期"); const height = Number(record.lengthHeightCm); if (!Number.isFinite(height) || height < 35 || height > 230) throw new Error("身高／身長必須介乎35至230厘米"); profile.records.push(normalizeRecord({ ...record, lengthHeightCm: height })); profile.records.sort((a, b) => a.date.localeCompare(b.date)); return state;
}
export function removeRecord(state, profileId, recordId) { const profile = state.profiles[profileId]; if (!profile) return state; profile.records = profile.records.filter((record) => record.id !== recordId); return state; }
