const GUEST_STORAGE_KEY = "HK_GROWTH_GUEST_SUBMISSIONS_V1";

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanOptionalNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function validateGuestSubmission(input) {
  const dateOfBirth = String(input.dateOfBirth || "");
  const recordDate = String(input.recordDate || "");
  const height = Number(input.lengthHeightCm);
  if (!String(input.name || "").trim()) throw new Error("請輸入小朋友稱呼或代號");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) throw new Error("請輸入有效生日");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) throw new Error("請輸入有效量度日期");
  if (recordDate < dateOfBirth) throw new Error("量度日期不可早於生日");
  if (recordDate > new Date().toISOString().slice(0, 10)) throw new Error("量度日期不可晚於今天");
  if (!Number.isFinite(height) || height < 35 || height > 230) throw new Error("身高／身長必須介乎35至230厘米");
  return {
    id: makeId(),
    createdAt: new Date().toISOString(),
    name: String(input.name).trim().slice(0, 80),
    sex: input.sex === "F" ? "F" : "M",
    dateOfBirth,
    record: {
      date: recordDate,
      lengthHeightCm: height,
      measurementMethod: input.measurementMethod === "recumbent" ? "recumbent" : "standing",
      weightKg: cleanOptionalNumber(input.weightKg),
      headCircumferenceCm: cleanOptionalNumber(input.headCircumferenceCm),
      notes: String(input.notes || "").slice(0, 500)
    }
  };
}

export function saveGuestSubmission(submission) {
  const existing = loadGuestSubmissions();
  existing.push(submission);
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(existing.slice(-20)));
  return submission;
}

export async function submitGuestSubmission(submission) {
  const endpoint = String(globalThis.GUEST_API_URL || "").trim();
  if (!endpoint) return { mode: "local", submission: saveGuestSubmission(submission) };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission)
  });
  if (!response.ok) throw new Error("提交失敗，請稍後再試");
  return { mode: "remote", submission };
}

export function loadGuestSubmissions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getGuestStorageKey() {
  return GUEST_STORAGE_KEY;
}
