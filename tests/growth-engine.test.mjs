import test from "node:test";
import assert from "node:assert/strict";
import { calculateAgeFromDates, calculateGrowth, generateSameCentileTrajectory } from "../js/growth-engine.js";
import { HK2020_HEIGHT } from "../data/hk2020-height.js";
import { HK2020_WEIGHT } from "../data/hk2020-weight.js";

test("HK2020 boys benchmark at 48 months", () => {
  const result = calculateGrowth(106, 48, HK2020_HEIGHT.M);
  assert.ok(Math.abs(result.z - 0.9024) < 0.01);
  assert.ok(Math.abs(result.percentile - 81.66) < 0.5);
});

test("HK2020 girls benchmark at birth", () => {
  const result = calculateGrowth(49.5, 0, HK2020_HEIGHT.F);
  assert.ok(Math.abs(result.z - 0.3886) < 0.01);
  assert.ok(Math.abs(result.percentile - 65.12) < 0.5);
});

test("same-centile trajectory starts at the latest measurement and reaches 216 months", () => {
  const trajectory = generateSameCentileTrajectory({ measurement: 106, ageMonths: 48 }, HK2020_HEIGHT.M);
  assert.equal(trajectory.points[0].x, 48);
  assert.ok(Math.abs(trajectory.points[0].y - 106) < 0.02);
  assert.equal(trajectory.points.at(-1).x, 216);
  assert.ok(Math.abs(trajectory.points.at(-1).y - 177.95) < 0.2);
});

test("adult reference uses the exact calendar age of Kaka's latest record", () => {
  const age = calculateAgeFromDates("2022-06-02", "2026-09-24");
  const trajectory = generateSameCentileTrajectory({ measurement: 106, ageMonths: age.ageMonths }, HK2020_HEIGHT.M);
  assert.ok(Math.abs(trajectory.points.at(-1).y - 174.97) < 0.2);
});

test("entry date automatically records exact calendar age for Kaka", () => {
  const age = calculateAgeFromDates("2022-06-02", "2026-09-24");
  assert.equal(age.label, "4歲 3個月 22日");
});

test("entry date automatically records exact calendar age for Yuyu", () => {
  const age = calculateAgeFromDates("2026-09-18", "2026-09-24");
  assert.equal(age.label, "6日");
});

test("HK2020 boys weight benchmark at 48 months", () => {
  const result = calculateGrowth(16.8, 48, HK2020_WEIGHT.M);
  assert.ok(Math.abs(result.z - 0.395) < 0.01);
  assert.ok(Math.abs(result.percentile - 65.36) < 0.5);
});

test("HK2020 girls weight benchmark at birth", () => {
  const result = calculateGrowth(3.0, 0, HK2020_WEIGHT.F);
  assert.ok(Math.abs(result.z - (-0.1258)) < 0.01);
  assert.ok(Math.abs(result.percentile - 44.99) < 0.5);
});

test("HK2020 weight median measurements have z near zero", () => {
  const boyMedian = HK2020_WEIGHT.M.find((row) => row.ageMonths === 48).M;
  const girlMedian = HK2020_WEIGHT.F.find((row) => row.ageMonths === 0).M;
  assert.ok(Math.abs(calculateGrowth(boyMedian, 48, HK2020_WEIGHT.M).z) < 1e-8);
  assert.ok(Math.abs(calculateGrowth(girlMedian, 0, HK2020_WEIGHT.F).z) < 1e-8);
});

test("same-centile weight trajectory starts at the latest measurement and reaches 216 months", () => {
  const trajectory = generateSameCentileTrajectory({ measurement: 16.8, ageMonths: 48 }, HK2020_WEIGHT.M);
  assert.equal(trajectory.points[0].x, 48);
  assert.ok(Math.abs(trajectory.points[0].y - 16.8) < 0.02);
  assert.equal(trajectory.points.at(-1).x, 216);
  assert.ok(Math.abs(trajectory.points.at(-1).y - 63.39) < 0.2);
});
