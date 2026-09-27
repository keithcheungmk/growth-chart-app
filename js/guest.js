import { HK2020_HEIGHT } from "../data/hk2020-height.js";
import { calculateAgeFromDates, calculateGrowth, formatPercentile, generateSameCentileTrajectory } from "./growth-engine.js";
import { submitGuestSubmission, validateGuestSubmission } from "./guest-storage.js";

const $ = (selector) => document.querySelector(selector);
let chart;

function updateAgePreview() {
  const dob = $("#guest-dob").value;
  const recordDate = $("#guest-record-date").value;
  if (!dob || !recordDate) return;
  try {
    const age = calculateAgeFromDates(dob, recordDate);
    $("#guest-age-preview").textContent = `系統自動計算年齡：${age.label}`;
    $("#guest-method").value = age.ageMonths < 24 ? "recumbent" : "standing";
  } catch (error) {
    $("#guest-age-preview").textContent = error.message;
  }
}

function renderResult(submission) {
  const table = HK2020_HEIGHT[submission.sex];
  const age = calculateAgeFromDates(submission.dateOfBirth, submission.record.date);
  const result = calculateGrowth(submission.record.lengthHeightCm, age.ageMonths, table);
  const trajectory = generateSameCentileTrajectory({ measurement: submission.record.lengthHeightCm, ageMonths: age.ageMonths }, table);
  $("#guest-result").hidden = false;
  $("#guest-result-title").textContent = submission.name;
  $("#guest-height-result").textContent = `${submission.record.lengthHeightCm.toFixed(1)} cm`;
  $("#guest-age-result").textContent = `${age.label} · ${submission.record.date}`;
  $("#guest-percentile-result").textContent = formatPercentile(result.percentile);
  $("#guest-zscore-result").textContent = `Z-score ${result.z.toFixed(2)}`;
  if (chart) chart.destroy();
  chart = new Chart($("#guest-chart"), {
    type: "line",
    data: { datasets: [
      { label: "同百分位參考軌跡", data: trajectory.points, borderColor: "#cf6b9f", backgroundColor: "#cf6b9f", borderWidth: 2.5, borderDash: [7, 6], pointRadius: 0, tension: .25 },
      { label: "實測記錄", data: [{ x: age.ageMonths, y: submission.record.lengthHeightCm }], borderColor: "#176b87", backgroundColor: "#176b87", pointRadius: 6, pointHoverRadius: 8, borderWidth: 3, showLine: false }
    ] },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "nearest", intersect: false }, plugins: { legend: { display: true }, tooltip: { callbacks: { title: (items) => items.length ? `年齡 ${items[0].parsed.x.toFixed(1)} 個月` : "", label: (item) => `${item.dataset.label}: ${item.parsed.y.toFixed(1)} cm` } } }, scales: { x: { type: "linear", min: 0, max: 216, title: { display: true, text: "年齡（月）" } }, y: { title: { display: true, text: "厘米" } } } }
  });
  $("#guest-result").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#guest-dob").addEventListener("change", updateAgePreview);
$("#guest-record-date").addEventListener("change", updateAgePreview);
$("#guest-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#guest-error").textContent = "";
  try {
    const submission = validateGuestSubmission({
      name: $("#guest-name").value,
      sex: $("#guest-sex").value,
      dateOfBirth: $("#guest-dob").value,
      recordDate: $("#guest-record-date").value,
      lengthHeightCm: $("#guest-height").value,
      measurementMethod: $("#guest-method").value,
      weightKg: $("#guest-weight").value,
      headCircumferenceCm: $("#guest-head").value,
      notes: $("#guest-notes").value
    });
    const result = await submitGuestSubmission(submission);
    renderResult(submission);
    $(".guest-storage-note").textContent = result.mode === "remote" ? "資料已提交。你只會看到自己今次嘅記錄。" : "此版本暫時只儲存喺此瀏覽器；接上私人 API 後可以跨裝置同步。";
  } catch (error) {
    $("#guest-error").textContent = error.message;
  }
});

$("#guest-record-date").value = new Date().toISOString().slice(0, 10);
