export const REFERENCE_INFO = {
  HK2020: { label: "HK2020", fullLabel: "HK2020 香港參考", maxMonths: 216 }
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function interpolateLms(ageMonths, table) {
  if (!Array.isArray(table) || table.length === 0) throw new Error("沒有可用的生長參考資料");
  const age = clamp(Number(ageMonths), table[0].ageMonths, table[table.length - 1].ageMonths);
  if (age <= table[0].ageMonths) return { ...table[0] };
  if (age >= table[table.length - 1].ageMonths) return { ...table[table.length - 1] };
  let upperIndex = table.findIndex((row) => row.ageMonths >= age);
  if (table[upperIndex].ageMonths === age) return { ...table[upperIndex] };
  const lower = table[upperIndex - 1];
  const upper = table[upperIndex];
  const ratio = (age - lower.ageMonths) / (upper.ageMonths - lower.ageMonths);
  return {
    ageMonths: age,
    L: lower.L + (upper.L - lower.L) * ratio,
    M: lower.M + (upper.M - lower.M) * ratio,
    S: lower.S + (upper.S - lower.S) * ratio,
    centiles: Object.fromEntries(Object.keys(lower.centiles).map((key) => [key, lower.centiles[key] + (upper.centiles[key] - lower.centiles[key]) * ratio]))
  };
}

export function measurementToZ(measurement, lms) {
  const value = Number(measurement);
  if (!Number.isFinite(value) || value <= 0) throw new Error("量度數值必須是正數");
  if (Math.abs(lms.L) < 1e-8) return Math.log(value / lms.M) / lms.S;
  return (Math.pow(value / lms.M, lms.L) - 1) / (lms.L * lms.S);
}

export function zToMeasurement(z, lms) {
  if (Math.abs(lms.L) < 1e-8) return lms.M * Math.exp(lms.S * z);
  const base = 1 + lms.L * lms.S * z;
  if (base <= 0) return null;
  return lms.M * Math.pow(base, 1 / lms.L);
}

export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * value);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-value * value);
  return sign * y;
}

export function calculateGrowth(measurement, ageMonths, table) {
  const lms = interpolateLms(ageMonths, table);
  const z = measurementToZ(measurement, lms);
  return { ageMonths, measurement: Number(measurement), z, percentile: normalCdf(z) * 100, lms };
}

export function generateSameCentileTrajectory(latest, table, endMonths = 216, stepMonths = 1) {
  const start = clamp(Number(latest.ageMonths), 0, endMonths);
  const startLms = interpolateLms(start, table);
  const z = measurementToZ(latest.measurement, startLms);
  const points = [];
  for (let age = start; age < endMonths; age += stepMonths) {
    const lms = interpolateLms(age, table);
    const measurement = zToMeasurement(z, lms);
    if (measurement !== null) points.push({ x: Number(age.toFixed(3)), y: Number(measurement.toFixed(2)) });
  }
  const finalLms = interpolateLms(endMonths, table);
  const finalMeasurement = zToMeasurement(z, finalLms);
  if (finalMeasurement !== null) points.push({ x: endMonths, y: Number(finalMeasurement.toFixed(2)) });
  return { z, points };
}

export function formatPercentile(percentile) {
  if (!Number.isFinite(percentile)) return "—";
  return `第 ${percentile.toFixed(1)} 百分位`;
}

export function formatAge(ageMonths) {
  const months = Math.max(0, Number(ageMonths));
  if (months < 1) return `${Math.round(months * 30.4375)}日`;
  const years = Math.floor(months / 12);
  const remainder = Math.floor(months % 12);
  return years > 0 ? `${years}歲${remainder}個月` : `${remainder}個月`;
}

export function calculateAgeFromDates(dateOfBirth, recordDate) {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDate.test(dateOfBirth) || !isoDate.test(recordDate)) throw new Error("日期格式不正確");
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const record = new Date(`${recordDate}T00:00:00Z`);
  if (record < birth) throw new Error("量度日期不可早於出生日期");
  let years = record.getUTCFullYear() - birth.getUTCFullYear();
  let months = record.getUTCMonth() - birth.getUTCMonth();
  let days = record.getUTCDate() - birth.getUTCDate();
  if (days < 0) {
    months -= 1;
    days += new Date(Date.UTC(record.getUTCFullYear(), record.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalDays = (record - birth) / 86400000;
  const ageMonths = totalDays / 30.4375;
  const parts = [];
  if (years) parts.push(`${years}歲`);
  if (months) parts.push(`${months}個月`);
  if (days || parts.length === 0) parts.push(`${days}日`);
  return { years, months, days, totalDays, ageMonths, label: parts.join(" ") };
}
