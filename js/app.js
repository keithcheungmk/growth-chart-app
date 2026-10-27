import { HK2020_HEIGHT } from "../data/hk2020-height.js";
import { HK2020_WEIGHT } from "../data/hk2020-weight.js";
import { REFERENCE_INFO, calculateAgeFromDates, calculateGrowth, formatAge, formatPercentile, generateSameCentileTrajectory } from "./growth-engine.js";
import { loadState, saveState, exportState, importState, addRecord, updateRecord, removeRecord } from "./storage.js";

const state = loadState();
let chart;
let viewEndMonths = 216;
let metric = "height";
let editingRecordId = null;
const focusedPercentiles = new Set(["p25", "p50", "p75"]);
const percentileStyles = {
  p25: { label: "P25", color: "#3d93a2" },
  p50: { label: "P50", color: "#176b87" },
  p75: { label: "P75", color: "#2f8796" }
};
const profilePalettes = {
  kaka: { actual: "#176b87", projected: "#d65d60" },
  yuyu: { actual: "#b34f86", projected: "#cf6b9f" }
};
const metricConfig = {
  height: {
    table: HK2020_HEIGHT,
    field: "lengthHeightCm",
    unit: "cm",
    axis: "厘米",
    latestLabel: "最新身高／身長",
    adultLabel: "18歲同百分位參考",
    chartEyebrow: "身長／身高",
    hint: "移動或點擊圖表查看厘米值",
    chartLabel: "兒童身高生長曲線"
  },
  weight: {
    table: HK2020_WEIGHT,
    field: "weightKg",
    unit: "kg",
    axis: "公斤",
    latestLabel: "最新體重",
    adultLabel: "同百分位參考軌跡終點",
    chartEyebrow: "體重",
    hint: "移動或點擊圖表查看公斤值",
    chartLabel: "兒童體重生長曲線"
  }
};
const $ = (selector) => document.querySelector(selector);
const profile = () => state.profiles[state.currentProfileId];
const ageInMonths = (dob, date) => calculateAgeFromDates(dob, date).ageMonths;
const currentMetric = () => metricConfig[metric];
const tableFor = () => currentMetric().table[profile().sex];
const currentReference = () => state.referenceStandard;
const hasMetric = (record) => record[currentMetric().field] != null;

function formatMeasurement(value, unit = currentMetric().unit) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  if (unit === "kg") return `${number.toFixed(number < 10 ? 2 : 1)} kg`;
  return `${number.toFixed(1)} cm`;
}

function recordTitle(record) {
  const parts = [record.date];
  if (record.lengthHeightCm != null) parts.push(formatMeasurement(record.lengthHeightCm, "cm"));
  if (record.weightKg != null) parts.push(formatMeasurement(record.weightKg, "kg"));
  return parts.join(" · ");
}

function getRecords() { return [...profile().records].sort((a, b) => a.date.localeCompare(b.date)); }
function render() { renderProfileTabs(); renderControls(); renderSummary(); renderChart(); renderHistoryCollapsible(); }
function formatProfileDate(value) { return new Intl.DateTimeFormat("zh-HK", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function renderProfileTabs() { document.body.dataset.profile = state.currentProfileId; document.querySelectorAll(".profile-tab").forEach((button) => button.classList.toggle("active", button.dataset.profile === state.currentProfileId)); const details = [`生日：${formatProfileDate(profile().dateOfBirth)}`]; if (profile().expectedDateOfConfinement) details.push(`預產期：${formatProfileDate(profile().expectedDateOfConfinement)}`); if (profile().gestationalAgeWeeks != null) details.push(`出生週數：${profile().gestationalAgeWeeks}週${profile().gestationalAgeDays || 0}日`); $("#profile-meta").textContent = details.join(" · "); }
function renderControls() {
  $("#reference-badge").textContent = REFERENCE_INFO[currentReference()].label;
  document.querySelectorAll("[data-range]").forEach((button) => button.classList.toggle("active", Number(button.dataset.range) === viewEndMonths));
  document.querySelectorAll("[data-percentile]").forEach((button) => button.setAttribute("aria-pressed", String(focusedPercentiles.has(button.dataset.percentile))));
  const shownPercentiles = ["p25", "p50", "p75"].filter((key) => focusedPercentiles.has(key)).map((key) => key.toUpperCase());
  $("#percentile-summary").textContent = shownPercentiles.length ? shownPercentiles.join(" · ") : "沒有重點線";
  document.querySelectorAll("[data-metric]").forEach((button) => {
    const selected = button.dataset.metric === metric;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const config = currentMetric();
  $("#chart-eyebrow").textContent = config.chartEyebrow;
  $("#chart-hint").textContent = config.hint;
  $("#growth-chart").setAttribute("aria-label", config.chartLabel);
}
function latestResult() {
  const records = getRecords().filter(hasMetric);
  if (!records.length) return null;
  const latest = records.at(-1);
  return { record: latest, result: calculateGrowth(latest[currentMetric().field], ageInMonths(profile().dateOfBirth, latest.date), tableFor()) };
}
function latestTrajectory() {
  const latest = latestResult();
  return latest ? generateSameCentileTrajectory({ measurement: latest.record[currentMetric().field], ageMonths: latest.result.ageMonths }, tableFor()) : null;
}
function renderSummary() {
  const config = currentMetric();
  $("#latest-metric-label").textContent = config.latestLabel;
  $("#adult-reference-label").textContent = config.adultLabel;
  const latest = latestResult();
  if (!latest) {
    ["#latest-height", "#latest-age", "#latest-percentile", "#latest-zscore", "#adult-reference"].forEach((selector) => $(selector).textContent = "—");
    $("#adult-reference-note").textContent = "按量度時精確年齡投影 · 非醫療預測";
    return;
  }
  const { record, result } = latest;
  const exactAge = calculateAgeFromDates(profile().dateOfBirth, record.date);
  $("#latest-height").textContent = formatMeasurement(record[config.field], config.unit);
  $("#latest-age").textContent = `${exactAge.label} · ${record.date}`;
  $("#latest-percentile").textContent = formatPercentile(result.percentile);
  $("#latest-zscore").textContent = `Z-score ${result.z.toFixed(2)}`;
  const adult = latestTrajectory()?.points.at(-1);
  $("#adult-reference").textContent = adult ? formatMeasurement(adult.y, config.unit) : "—";
  $("#adult-reference-note").textContent = `按量度時 ${exactAge.label} 投影 · 非醫療預測`;
}
function referenceDatasets() { const rows = tableFor(); const keys = [{ key: "p0_4", label: "P0.4" }, { key: "p2", label: "P2" }, { key: "p9", label: "P9" }, { key: "p25", label: "P25" }, { key: "p50", label: "P50" }, { key: "p75", label: "P75" }, { key: "p91", label: "P91" }, { key: "p98", label: "P98" }, { key: "p99_6", label: "P99.6" }]; return keys.map(({ key, label }) => { const focused = focusedPercentiles.has(key); const style = percentileStyles[key]; return { label, data: rows.map((row) => ({ x: row.ageMonths, y: row.centiles[key] })), borderColor: style?.color ?? "rgba(121,149,157,.26)", borderWidth: key === "p50" ? 2.4 : focused ? 2 : 1, pointRadius: 0, borderDash: key === "p50" ? [4, 3] : focused ? [6, 4] : [2, 4], tension: .22, order: 3, tooltip: focused, focusLabel: style?.label ?? null }; }); }
const focusLabelPlugin = { id: "focus-labels", afterDatasetsDraw(chartInstance) { const { ctx, chartArea } = chartInstance; const occupied = []; ctx.save(); ctx.font = "700 11px -apple-system, BlinkMacSystemFont, PingFang TC, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle"; chartInstance.data.datasets.forEach((dataset, datasetIndex) => { if (!dataset.focusLabel) return; const meta = chartInstance.getDatasetMeta(datasetIndex); const point = meta.data.at(-1); if (!point) return; const props = point.getProps(["x", "y"], true); let y = props.y; while (occupied.some((usedY) => Math.abs(usedY - y) < 14)) y += 14; occupied.push(y); ctx.fillStyle = dataset.borderColor; ctx.fillText(dataset.focusLabel, chartArea.right - 5, y); }); ctx.restore(); } };
function renderChart() {
  const config = currentMetric();
  const actual = getRecords().filter(hasMetric).map((record) => ({ x: ageInMonths(profile().dateOfBirth, record.date), y: record[config.field] }));
  const latest = latestResult();
  const projected = latest ? latestTrajectory()?.points ?? [] : [];
  const palette = profilePalettes[state.currentProfileId] || profilePalettes.kaka;
  const datasets = [...referenceDatasets(), { label: "實測記錄", data: actual, borderColor: palette.actual, backgroundColor: palette.actual, pointRadius: 5, pointHoverRadius: 7, borderWidth: 3, tension: .2, order: 1, tooltip: true }, { label: "同百分位參考軌跡", data: projected, borderColor: palette.projected, backgroundColor: palette.projected, pointRadius: 0, borderWidth: 2.5, borderDash: [7, 6], tension: .25, order: 2, tooltip: true }];
  const ctx = $("#growth-chart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, { type: "line", data: { datasets }, plugins: [focusLabelPlugin], options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "x", intersect: false, axis: "x" }, plugins: { legend: { display: false }, tooltip: { mode: "x", intersect: false, filter: (item) => item.dataset.tooltip !== false, callbacks: { title: (items) => items.length ? formatAge(items[0].parsed.x) : "", label: (item) => `${item.dataset.label}: ${formatMeasurement(item.parsed.y, config.unit)}` } } }, scales: { x: { type: "linear", min: 0, max: viewEndMonths, title: { display: true, text: "年齡" }, ticks: { callback: (value) => `${Number(value) / 12}歲` }, grid: { color: "rgba(151,176,182,.16)" } }, y: { title: { display: true, text: config.axis }, grid: { color: "rgba(151,176,182,.16)" } } } } });
}

function metricGrowth(record) {
  const value = record[currentMetric().field];
  if (value == null) return null;
  const age = calculateAgeFromDates(profile().dateOfBirth, record.date);
  return calculateGrowth(value, age.ageMonths, tableFor());
}

function renderHistoryCollapsible() {
  const list = $("#history-list");
  const records = getRecords().reverse();
  if (!records.length) {
    list.innerHTML = '<div class="history-empty">尚未有量度記錄。</div>';
    return;
  }
  list.replaceChildren(...records.map((record, index) => {
    const item = document.createElement("details");
    item.className = "history-item";
    item.open = index === 0;
    const age = calculateAgeFromDates(profile().dateOfBirth, record.date);
    const result = metricGrowth(record);
    const summary = document.createElement("summary");
    summary.className = "history-summary";
    const main = document.createElement("div");
    main.className = "history-main";
    const title = document.createElement("strong");
    title.textContent = recordTitle(record);
    const meta = document.createElement("span");
    const methodLabel = record.measurementMethod === "recumbent" ? "躺臥身長" : "站立身高";
    meta.textContent = record.lengthHeightCm != null ? `${age.label} · ${methodLabel}` : age.label;
    main.append(title, meta);
    const percentile = document.createElement("span");
    percentile.className = "history-percentile";
    percentile.textContent = result ? formatPercentile(result.percentile) : "—";
    summary.append(main, percentile);
    const details = document.createElement("div");
    details.className = "history-details";
    const detailLine = (label, value) => { const line = document.createElement("div"); line.innerHTML = `<span class="history-detail-label">${label}：</span>`; line.append(document.createTextNode(value)); return line; };
    if (record.lengthHeightCm != null) details.append(detailLine("量度方式", methodLabel), detailLine("身高／身長", formatMeasurement(record.lengthHeightCm, "cm")));
    if (record.weightKg != null) details.append(detailLine("體重", formatMeasurement(record.weightKg, "kg")));
    if (record.headCircumferenceCm != null) details.append(detailLine("頭圍", `${record.headCircumferenceCm} cm`));
    if (record.notes) details.append(detailLine("備註", record.notes));
    const actions = document.createElement("div");
    actions.className = "history-actions";
    const editButton = document.createElement("button");
    editButton.className = "edit-button";
    editButton.type = "button";
    editButton.textContent = "修改此記錄";
    editButton.addEventListener("click", (event) => { event.preventDefault(); openEditDialog(record); });
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "刪除此記錄";
    deleteButton.addEventListener("click", (event) => { event.preventDefault(); if (!window.confirm("確定刪除此記錄？")) return; removeRecord(state, state.currentProfileId, record.id); saveState(state); render(); });
    actions.append(editButton, deleteButton);
    details.append(actions);
    item.append(summary, details);
    return item;
  }));
}

function updateAgePreview({ preserveMethod = false } = {}) {
  try {
    const age = calculateAgeFromDates(profile().dateOfBirth, $("#record-date").value);
    $("#record-age-preview").textContent = `系統自動記錄年齡：${age.label}`;
    if (!preserveMethod) $("#record-method").value = age.ageMonths < 24 ? "recumbent" : "standing";
    $("#form-error").textContent = "";
  } catch (error) {
    $("#record-age-preview").textContent = "系統會按生日自動計算年齡";
    $("#form-error").textContent = error.message;
  }
}

function setDialogMode(mode) {
  const isEdit = mode === "edit";
  $("#dialog-eyebrow").textContent = isEdit ? "修改量度" : "新增量度";
  $("#dialog-title").textContent = isEdit ? "修改記錄" : "記錄量度";
  $("#record-form button[type='submit']").textContent = isEdit ? "儲存修改" : "儲存記錄";
}

function showDialog() {
  const dialog = $("#record-dialog");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function openDialog() {
  editingRecordId = null;
  $("#editing-record-id").value = "";
  setDialogMode("create");
  $("#record-date").value = new Date().toISOString().slice(0, 10);
  $("#record-height").value = "";
  $("#record-weight").value = "";
  $("#record-head").value = "";
  $("#record-notes").value = "";
  $("#form-error").textContent = "";
  updateAgePreview();
  showDialog();
}

function openEditDialog(record) {
  editingRecordId = record.id;
  $("#editing-record-id").value = record.id;
  setDialogMode("edit");
  $("#record-date").value = record.date;
  $("#record-height").value = record.lengthHeightCm ?? "";
  $("#record-weight").value = record.weightKg ?? "";
  $("#record-head").value = record.headCircumferenceCm ?? "";
  $("#record-notes").value = record.notes || "";
  $("#record-method").value = record.measurementMethod === "recumbent" ? "recumbent" : "standing";
  $("#form-error").textContent = "";
  updateAgePreview({ preserveMethod: true });
  showDialog();
}

function closeDialog() {
  editingRecordId = null;
  $("#editing-record-id").value = "";
  setDialogMode("create");
  const dialog = $("#record-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

$("#add-record-button").addEventListener("click", openDialog); $("#cancel-dialog").addEventListener("click", closeDialog); $("#close-dialog").addEventListener("click", closeDialog);
$("#record-date").addEventListener("change", () => updateAgePreview());
$("#record-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = {
    date: $("#record-date").value,
    lengthHeightCm: $("#record-height").value,
    measurementMethod: $("#record-method").value,
    weightKg: $("#record-weight").value,
    headCircumferenceCm: $("#record-head").value || null,
    notes: $("#record-notes").value
  };
  try {
    if (editingRecordId) updateRecord(state, state.currentProfileId, editingRecordId, payload);
    else addRecord(state, state.currentProfileId, payload);
    saveState(state);
    closeDialog();
    render();
  } catch (error) {
    $("#form-error").textContent = error.message;
  }
});
document.querySelectorAll(".profile-tab").forEach((button) => button.addEventListener("click", () => { state.currentProfileId = button.dataset.profile; saveState(state); render(); }));
document.querySelectorAll("[data-range]").forEach((button) => button.addEventListener("click", () => { viewEndMonths = Number(button.dataset.range); render(); }));
document.querySelectorAll("[data-metric]").forEach((button) => button.addEventListener("click", () => { metric = button.dataset.metric; render(); }));
$("#export-button").addEventListener("click", () => exportState(state)); $("#import-button").addEventListener("click", () => $("#import-input").click()); $("#import-input").addEventListener("change", async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const imported = importState(await file.text()); Object.assign(state, imported); saveState(state); render(); window.alert("備份已匯入。"); } catch (error) { window.alert(`匯入失敗：${error.message}`); } event.target.value = ""; });
document.querySelectorAll("[data-percentile]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.percentile; if (focusedPercentiles.has(key) && focusedPercentiles.size === 1) return; if (focusedPercentiles.has(key)) focusedPercentiles.delete(key); else focusedPercentiles.add(key); render(); }));
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
render();
